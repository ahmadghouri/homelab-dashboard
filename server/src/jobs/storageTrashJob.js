import { purgeExpiredTrash } from '../services/storage/fileService.js';

const FIRST_RUN_DELAY_MS = 30 * 1000;
const HOUR_MS = 60 * 60 * 1000;

let timer = null;
let firstRun = null;
let running = false;

// Deletes items older than STORAGE_TRASH_DAYS from Google Drive and the database.
async function runPurge() {
  if (running) return;
  running = true;
  try {
    const result = await purgeExpiredTrash();
    if (result.files + result.folders + result.failed > 0) {
      console.log(
        `[drive] trash cleanup: ${result.files} files, ${result.folders} folders deleted, ${result.failed} failed`,
      );
    }
  } catch (error) {
    console.error('[drive] trash cleanup failed:', error.message);
  } finally {
    running = false;
  }
}

export async function startStorageTrashJob() {
  stopStorageTrashJob();
  firstRun = setTimeout(runPurge, FIRST_RUN_DELAY_MS);
  timer = setInterval(runPurge, HOUR_MS);
}

export function stopStorageTrashJob() {
  clearTimeout(firstRun);
  clearInterval(timer);
  firstRun = null;
  timer = null;
}
