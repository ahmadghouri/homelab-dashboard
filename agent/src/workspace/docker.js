// Docker containers through the docker CLI (list, start / stop / restart, recent logs).
// Never throws: a missing docker CLI or a stopped daemon is reported as available: false.
import { execFile } from 'node:child_process';

const LIST_TIMEOUT_MS = 10_000;
// docker stop waits up to 10 s for the container before killing it.
const ACTION_TIMEOUT_MS = 30_000;
const MAX_BUFFER_BYTES = 8 * 1024 * 1024;
const MAX_OUTPUT_LENGTH = 500;
const MAX_LINE_LENGTH = 2000;
const MIN_LOG_LINES = 1;
const MAX_LOG_LINES = 500;
const ID_LENGTH = 12;
const ACTIONS = ['start', 'stop', 'restart'];

export const NOT_INSTALLED_MESSAGE = 'Docker is not installed';

function run(args, timeout) {
  return new Promise((resolve) => {
    execFile(
      'docker',
      args,
      { timeout, windowsHide: true, maxBuffer: MAX_BUFFER_BYTES },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          notInstalled: error?.code === 'ENOENT',
          stdout: String(stdout ?? ''),
          stderr: String(stderr ?? ''),
          message: error?.message ?? '',
        });
      },
    );
  });
}

function reply(ok, output) {
  return { ok, output: String(output).trim().slice(0, MAX_OUTPUT_LENGTH) };
}

function failureText(result) {
  return (result.stderr || result.stdout || result.message).trim() || 'docker command failed';
}

function text(value) {
  return typeof value === 'string' ? value : '';
}

// One line of `docker ps -a --format "{{json .}}"` to { id, name, image, state, status, ports }, or null.
export function parseContainerLine(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('{')) {
    return null;
  }
  let raw;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    return null;
  }
  const id = text(raw.ID).slice(0, ID_LENGTH);
  if (!id) {
    return null;
  }
  return {
    id,
    // Names is a comma separated list; the first one is the container's own name.
    name: text(raw.Names).split(',')[0] || id,
    image: text(raw.Image),
    state: text(raw.State).toLowerCase() || 'unknown',
    status: text(raw.Status),
    ports: text(raw.Ports),
  };
}

export function parseContainerList(output) {
  return output.split(/\r?\n/).map(parseContainerLine).filter(Boolean);
}

// Returns { available, error, items: [{ id, name, image, state, status, ports }] }.
export async function listContainers() {
  try {
    const result = await run(['ps', '-a', '--no-trunc', '--format', '{{json .}}'], LIST_TIMEOUT_MS);
    if (result.notInstalled) {
      return { available: false, error: NOT_INSTALLED_MESSAGE, items: [] };
    }
    if (!result.ok) {
      // Usually the daemon is not running ("Cannot connect to the Docker daemon ...").
      return { available: false, error: failureText(result).slice(0, MAX_OUTPUT_LENGTH), items: [] };
    }
    return { available: true, error: null, items: parseContainerList(result.stdout) };
  } catch (error) {
    return { available: false, error: error.message, items: [] };
  }
}

// Finds a container of the current list by its 12 character id. Returns { container } or { failure }.
async function findContainer(id) {
  if (typeof id !== 'string' || !id) {
    return { failure: 'Unknown container' };
  }
  const list = await listContainers();
  if (!list.available) {
    return { failure: list.error };
  }
  const container = list.items.find((item) => item.id === id);
  return container ? { container } : { failure: 'Unknown container' };
}

// action: 'start' | 'stop' | 'restart'. Only ids that exist in the current list are accepted.
export async function containerAction(id, action) {
  if (!ACTIONS.includes(action)) {
    return reply(false, 'Unknown action');
  }
  try {
    const { container, failure } = await findContainer(id);
    if (!container) {
      return reply(false, failure);
    }
    const result = await run([action, container.id], ACTION_TIMEOUT_MS);
    if (!result.ok) {
      return reply(false, failureText(result));
    }
    return reply(true, `Container ${container.name}: ${action} done`);
  } catch (error) {
    return reply(false, error.message);
  }
}

function toLogLines(output, stream) {
  return output
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => ({ ts: null, stream, text: line.slice(0, MAX_LINE_LENGTH) }));
}

function clampLines(lines) {
  const count = Math.trunc(Number(lines));
  if (!Number.isFinite(count)) {
    return MAX_LOG_LINES;
  }
  return Math.min(Math.max(count, MIN_LOG_LINES), MAX_LOG_LINES);
}

// Returns { ok, output?, lines: [{ ts: null, stream: 'stdout' | 'stderr', text }] }, the last `lines` lines.
// stdout and stderr come back as two separate blocks because docker logs does not interleave them here.
export async function containerLogs(id, lines) {
  try {
    const { container, failure } = await findContainer(id);
    if (!container) {
      return { ok: false, output: String(failure).slice(0, MAX_OUTPUT_LENGTH), lines: [] };
    }
    const count = clampLines(lines);
    const result = await run(['logs', '--tail', String(count), container.id], LIST_TIMEOUT_MS);
    if (!result.ok) {
      return { ok: false, output: failureText(result).slice(0, MAX_OUTPUT_LENGTH), lines: [] };
    }
    const all = [...toLogLines(result.stdout, 'stdout'), ...toLogLines(result.stderr, 'stderr')];
    return { ok: true, lines: all.slice(-count) };
  } catch (error) {
    return { ok: false, output: error.message, lines: [] };
  }
}
