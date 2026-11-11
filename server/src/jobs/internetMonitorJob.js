import { probeInternet } from '../services/connectivity.js';
import {
  closeStaleOutages,
  isInternetOnline,
  isSpeedTestRunning,
  recordConnectivityCheck,
  runSpeedTest,
} from '../services/internetService.js';
import { getSettings, onSettingsChange } from '../services/settingsService.js';

const CHECK_INTERVAL_MS = 30 * 1000;
const MINUTE_MS = 60 * 1000;

let checkTimer = null;
let speedTestTimer = null;
let checking = false;
let unsubscribeSettings = null;

async function runCheck() {
  // A slow check (3 s timeout) never overlaps the next one, but guard anyway.
  if (checking) {
    return;
  }
  checking = true;
  try {
    const reachable = await probeInternet();
    await recordConnectivityCheck(reachable, new Date());
  } catch (error) {
    console.error('[internet] connectivity check failed:', error.message);
  } finally {
    checking = false;
  }
}

async function runScheduledSpeedTest() {
  if (!isInternetOnline() || isSpeedTestRunning()) {
    return;
  }
  try {
    await runSpeedTest('schedule');
  } catch (error) {
    console.error('[internet] scheduled speed test failed:', error.message);
  }
}

// 0 turns scheduled tests off. The first test runs after one interval, not at start,
// so server restarts do not use bandwidth.
function scheduleSpeedTests(intervalMin) {
  clearInterval(speedTestTimer);
  speedTestTimer = null;
  if (intervalMin > 0) {
    speedTestTimer = setInterval(runScheduledSpeedTest, intervalMin * MINUTE_MS);
  }
}

export async function startInternetMonitor() {
  await closeStaleOutages();
  const settings = await getSettings();
  scheduleSpeedTests(settings.internet.speedTestIntervalMin);

  checkTimer = setInterval(runCheck, CHECK_INTERVAL_MS);
  runCheck();

  unsubscribeSettings = onSettingsChange((next, previous) => {
    if (next.internet.speedTestIntervalMin !== previous.internet?.speedTestIntervalMin) {
      scheduleSpeedTests(next.internet.speedTestIntervalMin);
    }
  });
}

export function stopInternetMonitor() {
  clearInterval(checkTimer);
  clearInterval(speedTestTimer);
  checkTimer = null;
  speedTestTimer = null;
  unsubscribeSettings?.();
  unsubscribeSettings = null;
}
