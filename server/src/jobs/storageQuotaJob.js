import { syncAllAccounts } from '../services/storage/accountService.js';

const FIRST_SYNC_DELAY_MS = 10 * 1000;
const SYNC_INTERVAL_MS = 15 * 60 * 1000;

let firstTimer = null;
let timer = null;

async function runSync() {
  try {
    await syncAllAccounts();
  } catch (error) {
    console.error('[storage] quota sync failed:', error.message);
  }
}

// Refreshes the Drive quota of every connected account (and its "almost full" alert).
export async function startStorageQuotaJob() {
  stopStorageQuotaJob();
  firstTimer = setTimeout(runSync, FIRST_SYNC_DELAY_MS);
  timer = setInterval(runSync, SYNC_INTERVAL_MS);
}

export function stopStorageQuotaJob() {
  clearTimeout(firstTimer);
  clearInterval(timer);
  firstTimer = null;
  timer = null;
}
