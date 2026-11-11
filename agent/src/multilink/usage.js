import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// Per-line traffic accounting: byte totals (persisted, so data caps survive restarts), live rates and
// open connection counts. Sockets are sampled (bytesRead / bytesWritten), so data events stay untouched.

export const DEFAULT_USAGE_FILE = path.join(os.tmpdir(), 'homelab-agent', 'multilink-usage.json');

const SAMPLE_INTERVAL_MS = 1000;
const SAVE_INTERVAL_MS = 15_000;
const RATE_WINDOW_MS = 5000;
const MAX_SAVED_LINES = 64;
const MAX_LINE_ID_LENGTH = 64;

function isCounter(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

// Reads saved totals; a missing or broken file simply starts from zero.
function loadTotals(filePath, logger) {
  const totals = new Map();
  let data;
  try {
    data = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.warn?.(`[agent] multilink usage file ignored: ${error.message}`);
    }
    return totals;
  }
  const lines = data && typeof data.lines === 'object' ? data.lines : {};
  for (const [lineId, entry] of Object.entries(lines).slice(0, MAX_SAVED_LINES)) {
    if (lineId.length <= MAX_LINE_ID_LENGTH && isCounter(entry?.rxBytes) && isCounter(entry?.txBytes)) {
      totals.set(lineId, { rxBytes: entry.rxBytes, txBytes: entry.txBytes });
    }
  }
  return totals;
}

/**
 * @param {{ filePath?: string, logger?: Console, now?: () => number, timers?: boolean }} [options]
 *   `timers: false` turns off the background sampling / saving (tests call sample() and flush()).
 */
export function createUsage({ filePath = DEFAULT_USAGE_FILE, logger = console, now = Date.now, timers = true } = {}) {
  // lineId -> { rxBytes, txBytes, flowRx, flowTx, connections, history: [{ at, rx, tx }] }
  // rx/txBytes are the persisted totals (reset clears them); flowRx/flowTx only grow and feed the rates.
  const lines = new Map();
  // socket -> { lineId, read, written }
  const tracked = new Map();
  let dirty = false;
  let saving = null;
  let saveErrorLogged = false;

  function lineOf(lineId) {
    let entry = lines.get(lineId);
    if (!entry) {
      entry = { rxBytes: 0, txBytes: 0, flowRx: 0, flowTx: 0, connections: 0, history: [] };
      lines.set(lineId, entry);
    }
    return entry;
  }

  for (const [lineId, saved] of loadTotals(filePath, logger)) {
    Object.assign(lineOf(lineId), saved);
  }

  function collect(socket, state) {
    const read = socket.bytesRead ?? 0;
    const written = socket.bytesWritten ?? 0;
    const rx = Math.max(0, read - state.read);
    const tx = Math.max(0, written - state.written);
    state.read = read;
    state.written = written;
    if (rx === 0 && tx === 0) {
      return;
    }
    const entry = lineOf(state.lineId);
    entry.rxBytes += rx;
    entry.txBytes += tx;
    entry.flowRx += rx;
    entry.flowTx += tx;
    dirty = true;
  }

  // Counts the bytes of one upstream socket on a line until it closes.
  function track(lineId, socket) {
    const state = { lineId, read: socket.bytesRead ?? 0, written: socket.bytesWritten ?? 0 };
    tracked.set(socket, state);
    lineOf(lineId).connections += 1;
    socket.once('close', () => {
      collect(socket, state);
      tracked.delete(socket);
      lineOf(lineId).connections -= 1;
    });
  }

  // Reads every open socket and records one rate point per line.
  function sample() {
    for (const [socket, state] of tracked) {
      collect(socket, state);
    }
    const at = now();
    for (const entry of lines.values()) {
      entry.history.push({ at, rx: entry.flowRx, tx: entry.flowTx });
      // Keep one point at or before the window start so the window is always fully covered.
      while (entry.history.length > 2 && entry.history[1].at <= at - RATE_WINDOW_MS) {
        entry.history.shift();
      }
    }
  }

  function ratesOf(entry) {
    const { history } = entry;
    if (history.length < 2) {
      return { rxBps: 0, txBps: 0 };
    }
    const first = history[0];
    const last = history.at(-1);
    const seconds = (last.at - first.at) / 1000;
    if (seconds <= 0) {
      return { rxBps: 0, txBps: 0 };
    }
    return {
      rxBps: Math.round((last.rx - first.rx) / seconds),
      txBps: Math.round((last.tx - first.tx) / seconds),
    };
  }

  function describe(entry) {
    return {
      rxBytes: entry.rxBytes,
      txBytes: entry.txBytes,
      usedBytes: entry.rxBytes + entry.txBytes,
      ...ratesOf(entry),
      connections: entry.connections,
    };
  }

  // Data used on a line since its last reset (download + upload), for caps.
  function usedBytes(lineId) {
    const entry = lines.get(lineId);
    return entry ? entry.rxBytes + entry.txBytes : 0;
  }

  function lineStats(lineId) {
    const entry = lines.get(lineId);
    return entry
      ? describe(entry)
      : { rxBytes: 0, txBytes: 0, usedBytes: 0, rxBps: 0, txBps: 0, connections: 0 };
  }

  // { lines: { [lineId]: { rxBytes, txBytes, usedBytes, rxBps, txBps, connections } }, totals: { rxBps, txBps, connections } }
  function stats() {
    sample();
    const result = { lines: {}, totals: { rxBps: 0, txBps: 0, connections: 0 } };
    for (const [lineId, entry] of lines) {
      const line = describe(entry);
      result.lines[lineId] = line;
      result.totals.rxBps += line.rxBps;
      result.totals.txBps += line.txBps;
      result.totals.connections += line.connections;
    }
    return result;
  }

  function reset(lineId) {
    const entry = lineOf(lineId);
    // Bytes of open sockets up to now belong to the period before the reset.
    for (const [socket, state] of tracked) {
      if (state.lineId === lineId) {
        collect(socket, state);
      }
    }
    entry.rxBytes = 0;
    entry.txBytes = 0;
    dirty = true;
    return true;
  }

  function serialize() {
    const saved = {};
    for (const [lineId, entry] of [...lines].slice(0, MAX_SAVED_LINES)) {
      saved[lineId] = { rxBytes: entry.rxBytes, txBytes: entry.txBytes };
    }
    return JSON.stringify({ savedAt: new Date(now()).toISOString(), lines: saved });
  }

  function reportSaveError(error) {
    if (!saveErrorLogged) {
      saveErrorLogged = true;
      logger.warn?.(`[agent] could not save multilink usage: ${error.message}`);
    }
  }

  // Writes the totals if they changed (temp file + rename, so a crash never leaves half a file).
  async function flush() {
    if (saving) {
      await saving;
    }
    if (!dirty) {
      return;
    }
    dirty = false;
    const tempPath = `${filePath}.tmp`;
    saving = (async () => {
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(tempPath, serialize());
      await rename(tempPath, filePath);
    })()
      .catch((error) => {
        dirty = true;
        reportSaveError(error);
      })
      .finally(() => {
        saving = null;
      });
    await saving;
  }

  function flushSync() {
    sample();
    if (!dirty) {
      return;
    }
    try {
      mkdirSync(path.dirname(filePath), { recursive: true });
      writeFileSync(`${filePath}.tmp`, serialize());
      renameSync(`${filePath}.tmp`, filePath);
      dirty = false;
    } catch (error) {
      reportSaveError(error);
    }
  }

  const intervals = [];
  if (timers) {
    intervals.push(setInterval(sample, SAMPLE_INTERVAL_MS), setInterval(flush, SAVE_INTERVAL_MS));
    intervals.forEach((interval) => interval.unref());
  }

  // Stops the timers and saves the totals synchronously (safe to call while the process exits).
  function stop() {
    intervals.forEach((interval) => clearInterval(interval));
    intervals.length = 0;
    flushSync();
  }

  return { track, sample, stats, lineStats, usedBytes, reset, flush, stop };
}
