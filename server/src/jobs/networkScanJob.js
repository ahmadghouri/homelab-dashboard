import { scanNetwork } from '../services/networkService.js';
import { getSettings, onSettingsChange } from '../services/settingsService.js';

const FIRST_SCAN_DELAY_MS = 5000;
const MINUTE_MS = 60 * 1000;

let timer = null;

async function runScan() {
  try {
    await scanNetwork();
  } catch (error) {
    console.error('[network] scan failed:', error.message);
  }
}

function schedule(intervalMin) {
  clearInterval(timer);
  timer = setInterval(runScan, intervalMin * MINUTE_MS);
}

export async function startNetworkScanJob() {
  const settings = await getSettings();
  schedule(settings.network.scanIntervalMin);
  setTimeout(runScan, FIRST_SCAN_DELAY_MS);

  onSettingsChange((next, previous) => {
    if (next.network.scanIntervalMin !== previous.network?.scanIntervalMin) {
      schedule(next.network.scanIntervalMin);
    }
  });
}

export function stopNetworkScanJob() {
  clearInterval(timer);
  timer = null;
}
