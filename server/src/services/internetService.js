import { InternetOutage } from '../models/InternetOutage.js';
import { SpeedTest } from '../models/SpeedTest.js';
import { emitToDashboard } from '../sockets/registry.js';
import { HttpError } from '../utils/httpError.js';
import { onInternetStatus } from './alertEngine.js';
import { createConnectivityTracker } from './connectivity.js';
import { getSettings } from './settingsService.js';
import { measureInternetSpeed } from './speedTest.js';

const HOUR_MS = 60 * 60 * 1000;

export const SPEED_TEST_RANGES = {
  '24h': { durationMs: 24 * HOUR_MS },
  '7d': { durationMs: 7 * 24 * HOUR_MS },
  '30d': { durationMs: 30 * 24 * HOUR_MS },
};
// Safety cap: one test per minute for 30 days would still fit, normal use is far below.
const MAX_TESTS_PER_RANGE = 50_000;

const tracker = createConnectivityTracker();
let checkedAt = null;
let openOutageId = null;
let speedTestRunning = false;

// ---------- Connectivity ----------

// An outage still open at start means the server stopped during it. It is closed at the
// last failed check seen before the stop (or now, if there is none).
export async function closeStaleOutages() {
  const stale = await InternetOutage.find({ endedAt: null });
  for (const outage of stale) {
    outage.endedAt = outage.lastCheckedAt ?? new Date();
    await outage.save();
  }
}

async function openOutage(startedAt, at) {
  const outage = await InternetOutage.create({ startedAt, lastCheckedAt: at });
  openOutageId = outage._id;
}

async function closeOutage(endedAt) {
  if (!openOutageId) {
    return;
  }
  const outageId = openOutageId;
  openOutageId = null;
  await InternetOutage.updateOne({ _id: outageId }, { endedAt });
}

// Applies one connectivity check. State changes open/close outages, notify the dashboard
// and the alert engine. The first check only sets the state (no outage).
export async function recordConnectivityCheck(reachable, at = new Date()) {
  checkedAt = at;
  const { changed, initial, online, since } = tracker.update(reachable, at);

  if (!changed) {
    if (!online && openOutageId) {
      await InternetOutage.updateOne({ _id: openOutageId }, { lastCheckedAt: at });
    }
    return;
  }

  emitToDashboard('internet:status', { online, since, checkedAt: at });
  if (initial) {
    return;
  }
  onInternetStatus(online, { since });
  if (online) {
    await closeOutage(since);
  } else {
    await openOutage(since, at);
  }
}

export function isInternetOnline() {
  return tracker.getState().online === true;
}

// ---------- Speed tests ----------

export function isSpeedTestRunning() {
  return speedTestRunning;
}

// trigger: 'schedule' | 'manual'. Only one test runs at a time (409 otherwise).
// Resolves with the saved SpeedTest document, also for a failed test.
export async function runSpeedTest(trigger) {
  if (speedTestRunning) {
    throw new HttpError(409, 'A speed test is already running');
  }
  speedTestRunning = true;
  emitToDashboard('internet:speedtest:running', { running: true });
  try {
    const ts = new Date();
    const result = await measureInternetSpeed();
    const test = await SpeedTest.create({ ts, trigger, ...result });
    emitToDashboard('internet:speedtest', { test });
    return test;
  } finally {
    speedTestRunning = false;
    emitToDashboard('internet:speedtest:running', { running: false });
  }
}

// Oldest first, ready for a chart.
export function listSpeedTests(range) {
  const from = new Date(Date.now() - SPEED_TEST_RANGES[range].durationMs);
  return SpeedTest.find({ ts: { $gte: from } })
    .sort({ ts: 1 })
    .limit(MAX_TESTS_PER_RANGE);
}

// ---------- Status and outages ----------

export async function getInternetStatus() {
  const [settings, lastSpeedTest] = await Promise.all([
    getSettings(),
    // The last successful test, so the dashboard always has numbers to show.
    SpeedTest.findOne({ success: true }).sort({ ts: -1 }),
  ]);
  const { online, since } = tracker.getState();
  return {
    online,
    since,
    checkedAt,
    speedTestRunning,
    speedTestIntervalMin: settings.internet.speedTestIntervalMin,
    lastSpeedTest,
  };
}

function toOutageJson(outage, now) {
  const end = outage.endedAt ?? now;
  return {
    id: outage._id.toString(),
    startedAt: outage.startedAt,
    endedAt: outage.endedAt,
    durationSec: Math.max(0, Math.round((end - outage.startedAt) / 1000)),
  };
}

// Newest first. An ongoing outage counts its duration up to now.
export async function listOutages(limit) {
  const outages = await InternetOutage.find({}, { startedAt: 1, endedAt: 1 })
    .sort({ startedAt: -1 })
    .limit(limit)
    .lean();
  const now = new Date();
  return outages.map((outage) => toOutageJson(outage, now));
}
