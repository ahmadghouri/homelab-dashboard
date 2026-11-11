import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// Multi-Link settings sent from the dashboard (mode, sticky, per line role and cap), validated
// and saved to a small JSON file so they survive agent restarts. Last speed test results are
// kept in the same file (they are the weights of the "weighted" mode).

export const MODES = ['balanced', 'weighted', 'failover'];
export const ROLES = ['active', 'backup', 'off'];
export const MAX_LINES = 16;
const MAX_LINE_ID_LENGTH = 64;
const MIN_CAP_GB = 0.1;
const MAX_CAP_GB = 10_000;
const BYTES_PER_GB = 1e9;
// Interface names are free text, but never empty, too long or with control characters.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export const DEFAULT_SETTINGS = Object.freeze({ mode: 'balanced', sticky: true, lines: {} });

export function defaultSettingsFile() {
  return path.join(os.tmpdir(), 'homelab-agent', 'multilink-settings.json');
}

export function isValidLineId(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_LINE_ID_LENGTH &&
    !CONTROL_CHARS.test(value)
  );
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateLine(id, value) {
  if (!isValidLineId(id)) {
    return 'line ids must be 1 to 64 characters without control characters';
  }
  if (!isPlainObject(value) || !ROLES.includes(value.role)) {
    return `line "${id}" needs a role (${ROLES.join(', ')})`;
  }
  const cap = value.capGb ?? null;
  if (cap !== null && (typeof cap !== 'number' || !(cap >= MIN_CAP_GB && cap <= MAX_CAP_GB))) {
    return `line "${id}" cap must be null or ${MIN_CAP_GB} to ${MAX_CAP_GB} GB`;
  }
  return null;
}

// Returns { settings } or { error } (a short message for the dashboard).
export function validateSettings(payload) {
  if (!isPlainObject(payload)) {
    return { error: 'settings must be an object' };
  }
  if (!MODES.includes(payload.mode)) {
    return { error: `mode must be one of ${MODES.join(', ')}` };
  }
  if (typeof payload.sticky !== 'boolean') {
    return { error: 'sticky must be true or false' };
  }
  const lines = payload.lines ?? {};
  if (!isPlainObject(lines)) {
    return { error: 'lines must be an object' };
  }
  const entries = Object.entries(lines);
  if (entries.length > MAX_LINES) {
    return { error: `at most ${MAX_LINES} lines` };
  }
  const cleanLines = {};
  for (const [id, value] of entries) {
    const error = validateLine(id, value);
    if (error) {
      return { error };
    }
    cleanLines[id] = { role: value.role, capGb: value.capGb ?? null };
  }
  return { settings: { mode: payload.mode, sticky: payload.sticky, lines: cleanLines } };
}

function validateSpeedTests(value) {
  if (!isPlainObject(value)) {
    return {};
  }
  const clean = {};
  for (const [id, entry] of Object.entries(value).slice(0, MAX_LINES * 4)) {
    const validEntry =
      isValidLineId(id) &&
      isPlainObject(entry) &&
      typeof entry.at === 'string' &&
      typeof entry.ok === 'boolean' &&
      (entry.downloadMbps === null || Number.isFinite(entry.downloadMbps));
    if (validEntry) {
      clean[id] = { at: entry.at, ok: entry.ok, downloadMbps: entry.downloadMbps };
    }
  }
  return clean;
}

export function createSettingsStore({ file = defaultSettingsFile() } = {}) {
  let settings = { ...DEFAULT_SETTINGS };
  let speedTests = {};

  // A missing or broken file means defaults (a broken file is replaced on the next save).
  async function load() {
    let data;
    try {
      data = JSON.parse(await readFile(file, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('[agent] multilink: settings file is unreadable, using defaults');
      }
      return;
    }
    const result = validateSettings(data?.settings);
    if (result.settings) {
      settings = result.settings;
    }
    speedTests = validateSpeedTests(data?.speedTests);
  }

  // Write to a temporary file first so a crash never leaves a half written file.
  async function write() {
    await mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.tmp`;
    await writeFile(temporary, JSON.stringify({ settings, speedTests }, null, 2));
    await rename(temporary, file);
  }

  // One write at a time; each write stores the latest state.
  let writing = Promise.resolve();
  function persist() {
    writing = writing.then(write, write);
    return writing;
  }

  async function save(nextSettings) {
    settings = nextSettings;
    await persist();
  }

  async function recordSpeedTest(lineId, result) {
    speedTests = { ...speedTests, [lineId]: result };
    try {
      await persist();
    } catch (error) {
      console.warn('[agent] multilink: could not save the speed test result:', error.message);
    }
  }

  // Role and cap of a line. Phone tethering defaults to backup (mobile data costs money).
  function lineSettings(line) {
    const saved = settings.lines[line.id];
    const role = saved?.role ?? (line.kind === 'tethering' ? 'backup' : 'active');
    const capGb = saved?.capGb ?? null;
    return { role, capBytes: capGb === null ? null : Math.round(capGb * BYTES_PER_GB) };
  }

  // Configured order first (used by failover), then lines the settings do not mention.
  function order(lines) {
    const known = Object.keys(settings.lines);
    const rest = lines.map((line) => line.id).filter((id) => !known.includes(id));
    return [...known, ...rest];
  }

  return {
    load,
    save,
    recordSpeedTest,
    lineSettings,
    order,
    get: () => settings,
    lastSpeedTest: (lineId) => speedTests[lineId] ?? null,
  };
}
