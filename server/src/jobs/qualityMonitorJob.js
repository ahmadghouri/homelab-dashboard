import { runQualityCheck } from '../services/qualityService.js';

const CHECK_INTERVAL_MS = 60 * 1000;
// Lets the server finish starting before the first round of pings.
const FIRST_CHECK_DELAY_MS = 5000;

let intervalTimer = null;
let firstTimer = null;
let checking = false;

async function runCheck() {
  // A round takes about 10 s (20 s at most), but never let two overlap.
  if (checking) {
    return;
  }
  checking = true;
  try {
    await runQualityCheck();
  } catch (error) {
    console.error('[quality] check failed:', error.message);
  } finally {
    checking = false;
  }
}

export async function startQualityMonitor() {
  stopQualityMonitor();
  intervalTimer = setInterval(runCheck, CHECK_INTERVAL_MS);
  firstTimer = setTimeout(runCheck, FIRST_CHECK_DELAY_MS);
}

export function stopQualityMonitor() {
  clearInterval(intervalTimer);
  clearTimeout(firstTimer);
  intervalTimer = null;
  firstTimer = null;
}
