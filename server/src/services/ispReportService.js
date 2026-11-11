// Monthly ISP performance report: speed tests, outages (availability) and ping quality
// for one calendar month in the server's local time zone.
import { InternetOutage } from '../models/InternetOutage.js';
import { QualitySample } from '../models/QualitySample.js';
import { SpeedTest } from '../models/SpeedTest.js';

// Speed tests are at most one per few minutes; this only guards against runaway data.
const MAX_SPEED_TESTS = 50_000;

function round(value, digits) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

const pad = (value) => String(value).padStart(2, '0');

function formatMonth(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function formatDay(date) {
  return `${formatMonth(date)}-${pad(date.getDate())}`;
}

// "YYYY-MM" of today in local time.
export function currentMonth() {
  return formatMonth(new Date());
}

// Local month bounds: from (inclusive) to (exclusive).
function monthBounds(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return { from: new Date(year, monthNumber - 1, 1), to: new Date(year, monthNumber, 1) };
}

// Local day starts from `from` up to (not including) `until`. Built with the calendar, so
// days stay correct across daylight saving changes.
function dayStarts(from, until) {
  const days = [];
  for (let day = new Date(from); day < until; day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)) {
    days.push(day);
  }
  return days;
}

// Overlap of [start, end) with [from, to) in seconds.
function overlapSec(start, end, from, to) {
  const ms = Math.min(end, to) - Math.max(start, from);
  return ms > 0 ? ms / 1000 : 0;
}

async function loadSpeedTests(from, to) {
  return SpeedTest.find(
    { ts: { $gte: from, $lt: to } },
    { _id: 0, ts: 1, success: 1, downloadMbps: 1, uploadMbps: 1, pingMs: 1 },
  )
    .sort({ ts: 1 })
    .limit(MAX_SPEED_TESTS)
    .lean();
}

// Outages overlapping the month, clipped to [from, until]. An ongoing outage ends "now".
async function loadOutages(from, to, until, now) {
  const outages = await InternetOutage.find(
    { startedAt: { $lt: to }, $or: [{ endedAt: null }, { endedAt: { $gt: from } }] },
    { startedAt: 1, endedAt: 1 },
  )
    .sort({ startedAt: 1 })
    .lean();

  return outages
    .map((outage) => {
      const start = new Date(Math.max(outage.startedAt, from));
      const end = new Date(Math.min(outage.endedAt ?? now, until));
      return {
        startedAt: start,
        endedAt: end,
        ongoing: outage.endedAt === null && to > now,
        durationSec: Math.round(Math.max(0, end - start) / 1000),
      };
    })
    .filter((outage) => outage.endedAt > outage.startedAt);
}

// Ping quality to the ISP side (1.1.1.1). The router target is the home network, not the ISP.
async function loadQuality(from, to) {
  const [result] = await QualitySample.aggregate([
    { $match: { target: 'internet', ts: { $gte: from, $lt: to } } },
    {
      $group: {
        _id: null,
        samples: { $sum: 1 },
        avgLossPct: { $avg: '$lossPct' },
        avgLatencyMs: { $avg: '$avgMs' },
      },
    },
  ]);
  return {
    samples: result?.samples ?? 0,
    avgLossPct: round(result?.avgLossPct, 2),
    avgLatencyMs: round(result?.avgLatencyMs, 1),
  };
}

function summarizeSpeed(tests) {
  const ok = tests.filter((test) => test.success);
  const downloads = ok.map((test) => test.downloadMbps).filter((v) => typeof v === 'number');
  const uploads = ok.map((test) => test.uploadMbps).filter((v) => typeof v === 'number');
  const pings = ok.map((test) => test.pingMs).filter((v) => typeof v === 'number');
  return {
    tests: tests.length,
    failed: tests.length - ok.length,
    avgDownloadMbps: round(average(downloads), 2),
    avgUploadMbps: round(average(uploads), 2),
    minDownloadMbps: downloads.length ? round(Math.min(...downloads), 2) : null,
    maxDownloadMbps: downloads.length ? round(Math.max(...downloads), 2) : null,
    avgPingMs: round(average(pings), 1),
  };
}

function summarizeUptime(outages, elapsedSec) {
  const totalDowntimeSec = outages.reduce((sum, outage) => sum + outage.durationSec, 0);
  return {
    outages: outages.length,
    totalDowntimeSec,
    longestOutageSec: outages.reduce((max, outage) => Math.max(max, outage.durationSec), 0),
    availabilityPct:
      elapsedSec > 0 ? round(Math.max(0, 1 - totalDowntimeSec / elapsedSec) * 100, 2) : null,
  };
}

function buildDaily(days, tests, outages, until) {
  return days.map((dayStart) => {
    const dayEnd = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + 1);
    const dayTests = tests.filter((test) => test.success && test.ts >= dayStart && test.ts < dayEnd);
    const downloads = dayTests.map((test) => test.downloadMbps).filter((v) => typeof v === 'number');
    const uploads = dayTests.map((test) => test.uploadMbps).filter((v) => typeof v === 'number');
    const windowEnd = Math.min(dayEnd, until);
    const downtimeSec = outages.reduce(
      (sum, outage) => sum + overlapSec(outage.startedAt, outage.endedAt, dayStart, windowEnd),
      0,
    );
    return {
      date: formatDay(dayStart),
      avgDownloadMbps: round(average(downloads), 2),
      avgUploadMbps: round(average(uploads), 2),
      downtimeSec: Math.round(downtimeSec),
    };
  });
}

// month: "YYYY-MM" (validated). Resolves with { report, outages }:
// - report: the JSON returned by GET /api/reports/isp
// - outages: the clipped outages of the month (oldest first), used by the PDF
export async function buildIspReport(month) {
  const now = new Date();
  const { from, to } = monthBounds(month);
  // A month in progress only counts the time elapsed so far.
  const until = new Date(Math.min(to, now));
  const elapsedSec = Math.max(0, (until - from) / 1000);

  const [tests, outages, quality] = await Promise.all([
    loadSpeedTests(from, to),
    loadOutages(from, to, until, now),
    loadQuality(from, to),
  ]);

  // Without any data the monitor was not running, so availability is unknown (null), not 100%.
  const hasData = tests.length > 0 || outages.length > 0 || quality.samples > 0;
  const report = {
    month,
    from,
    to,
    hasData,
    speed: summarizeSpeed(tests),
    uptime: summarizeUptime(outages, hasData ? elapsedSec : 0),
    quality: { avgLossPct: quality.avgLossPct, avgLatencyMs: quality.avgLatencyMs },
    daily: buildDaily(dayStarts(from, until), tests, outages, until),
  };
  return { report, outages };
}
