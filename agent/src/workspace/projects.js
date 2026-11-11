import { execFile, spawn } from 'node:child_process';
import { closeSync, openSync, writeFileSync, mkdirSync } from 'node:fs';
import { open, stat, truncate } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import si from 'systeminformation';
import { createLogBuffer } from './logBuffer.js';
import { listListeningPorts } from './ports.js';

// Starts, stops and watches the dev projects listed in workspace.json.
// Output goes to files in the temp folder instead of pipes, so a project keeps running (and can
// keep printing) after the agent exits. The agent reads those files every second into a ring
// buffer.

const IS_WINDOWS = process.platform === 'win32';
const OUTPUT_DIR = path.join(os.tmpdir(), 'homelab-agent', 'projects');
const TAIL_INTERVAL_MS = 1000;
const MAX_READ_BYTES = 256 * 1024;
const MAX_OUTPUT_FILE_BYTES = 10 * 1024 * 1024;
const START_CHECK_MS = 700;
const STOP_WAIT_MS = 10_000;
const KILL_GRACE_MS = 5000;
const TASKKILL_TIMEOUT_MS = 10_000;
// After the agent stopped a project its port can look busy for a few seconds (cached port list).
const RECENT_STOP_MS = 10_000;
const PROCESS_TREE_CACHE_MS = 30_000;
const PROCESS_TREE_REFRESH_MS = 2000;
const SAFE_CMD_ARG = /^[A-Za-z0-9_\-+=.,:/\\@]+$/;
// Settings of the agent itself that projects must not see.
const HIDDEN_ENV = ['AGENT_TOKEN'];
// Prefix of the lines the agent adds to a project's log.
const AGENT_NOTE = '[agent]';

function reply(ok, output) {
  return { ok, output };
}

// Builds a cmd.exe command line. Arguments with spaces or special characters are quoted; quotes
// inside arguments cannot be passed safely through cmd.exe, so they are refused.
function toCmdLine(command) {
  const parts = command.map((part) => {
    if (part.includes('"')) {
      throw new Error('Command parts cannot contain double quotes on Windows');
    }
    return SAFE_CMD_ARG.test(part) ? part : `"${part}"`;
  });
  return `"${parts.join(' ')}"`;
}

function buildEnv(extra) {
  const env = { ...process.env, ...extra };
  for (const name of HIDDEN_ENV) {
    delete env[name];
  }
  return env;
}

function buildSpawn(project, stdio) {
  const options = { cwd: project.cwd, env: buildEnv(project.env), windowsHide: true, stdio };
  // Windows: always start through cmd.exe. It finds npm / composer (.cmd files), and Node puts its
  // direct children in a job that is closed when the agent exits; the real program is a child of
  // cmd.exe and is outside that job, so it keeps running after the agent exits.
  if (IS_WINDOWS) {
    return {
      file: 'cmd.exe',
      args: ['/d', '/s', '/c', toCmdLine(project.command)],
      options: { ...options, windowsVerbatimArguments: true },
    };
  }
  // On Linux and macOS the project gets its own process group, so stop can end all of it.
  const [program, ...args] = project.command;
  return { file: program, args, options: { ...options, detached: true } };
}

function outputFiles(id) {
  return {
    stdout: path.join(OUTPUT_DIR, `${id}.stdout.log`),
    stderr: path.join(OUTPUT_DIR, `${id}.stderr.log`),
  };
}

// Creates empty output files and returns append handles for the child process.
function openOutputFiles(files) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const fds = {};
  for (const stream of ['stdout', 'stderr']) {
    writeFileSync(files[stream], '');
    fds[stream] = openSync(files[stream], 'a');
  }
  return fds;
}

// Reads new bytes from the output files into the log buffer.
function createOutputTailer(files, buffer) {
  const offsets = { stdout: 0, stderr: 0 };
  let reading = null;

  async function readStream(stream) {
    const filePath = files[stream];
    const { size } = await stat(filePath);
    if (size < offsets[stream]) {
      offsets[stream] = 0;
    }
    if (size > offsets[stream]) {
      const length = Math.min(size - offsets[stream], MAX_READ_BYTES);
      const handle = await open(filePath, 'r');
      try {
        const bytes = Buffer.alloc(length);
        const { bytesRead } = await handle.read(bytes, 0, length, offsets[stream]);
        offsets[stream] += bytesRead;
        buffer.write(stream, bytes.subarray(0, bytesRead));
      } finally {
        await handle.close();
      }
    }
    // Keep the temp files small. The project appends, so it continues at the new end.
    if (offsets[stream] >= size && size > MAX_OUTPUT_FILE_BYTES) {
      await truncate(filePath, 0);
      offsets[stream] = 0;
    }
  }

  async function readAll() {
    for (const stream of ['stdout', 'stderr']) {
      try {
        await readStream(stream);
      } catch {
        // The file can be busy for a moment on Windows; try again on the next tick.
      }
    }
  }

  function tick() {
    reading ??= readAll().finally(() => {
      reading = null;
    });
    return reading;
  }

  const timer = setInterval(tick, TAIL_INTERVAL_MS);
  timer.unref();

  return {
    async stop() {
      clearInterval(timer);
      await reading;
      await readAll();
      buffer.flush();
    },
  };
}

function runTaskkill(args) {
  return new Promise((resolve) => {
    execFile('taskkill', args, { timeout: TASKKILL_TIMEOUT_MS, windowsHide: true }, () =>
      resolve(),
    );
  });
}

async function killTree(pid) {
  if (IS_WINDOWS) {
    // `taskkill /T` alone can miss children (it killed cmd.exe but left its node child running
    // in testing), so every descendant found in a fresh process list is killed by PID too,
    // deepest first, before the root and whatever is left of its tree.
    let descendants = [];
    try {
      descendants = [...collectTree(await getChildrenMap(0), pid)].filter((p) => p !== pid);
    } catch {
      // Listing failed: fall back to taskkill /T below.
    }
    for (const child of descendants.reverse()) {
      await runTaskkill(['/PID', String(child), '/F']);
    }
    await runTaskkill(['/PID', String(pid), '/T', '/F']);
    return;
  }
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    return Promise.resolve();
  }
  const timer = setTimeout(() => {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      // Already gone.
    }
  }, KILL_GRACE_MS);
  timer.unref();
  return Promise.resolve();
}

function waitWithTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(false), ms);
  });
  return Promise.race([promise.then(() => true), timeout]).finally(() => clearTimeout(timer));
}

// The last error output of the latest run, for example "'x' is not recognized as ... command".
function lastStderrText(buffer) {
  const recent = buffer.tail(50);
  const startNote = `${AGENT_NOTE} started`;
  const startIndex = recent.findLastIndex((entry) => entry.text.startsWith(startNote));
  const text = recent
    .slice(startIndex + 1)
    .filter((entry) => entry.stream === 'stderr' && entry.text.trim())
    .filter((entry) => !entry.text.startsWith(AGENT_NOTE))
    .slice(-2)
    .map((entry) => entry.text.trim())
    .join(' ');
  return text ? `: ${text}` : '';
}

async function isDirectory(dir) {
  try {
    return (await stat(dir)).isDirectory();
  } catch {
    return false;
  }
}

let processTreeCache = { at: 0, children: null };

// Map of parent PID to child PIDs, cached because listing processes is slow on Windows.
async function getChildrenMap(maxAgeMs) {
  if (processTreeCache.children && Date.now() - processTreeCache.at < maxAgeMs) {
    return processTreeCache.children;
  }
  const children = new Map();
  const { list } = await si.processes();
  for (const { pid, parentPid } of list) {
    if (!children.has(parentPid)) {
      children.set(parentPid, []);
    }
    children.get(parentPid).push(pid);
  }
  processTreeCache = { at: Date.now(), children };
  return children;
}

function collectTree(children, rootPid) {
  const pids = new Set([rootPid]);
  const queue = [rootPid];
  while (queue.length > 0) {
    for (const child of children.get(queue.shift()) ?? []) {
      if (!pids.has(child)) {
        pids.add(child);
        queue.push(child);
      }
    }
  }
  return pids;
}

// Returns the PID and all descendant PIDs of a process (only the PID when listing fails).
// When `expectedPid` is missing from a cached tree (a child started recently), the list is read
// again.
export async function getProcessTree(rootPid, expectedPid = null) {
  try {
    const pids = collectTree(await getChildrenMap(PROCESS_TREE_CACHE_MS), rootPid);
    if (expectedPid === null || pids.has(expectedPid)) {
      return pids;
    }
    return collectTree(await getChildrenMap(PROCESS_TREE_REFRESH_MS), rootPid);
  } catch {
    // Process listing failed; the root PID alone is still useful.
    return new Set([rootPid]);
  }
}

export function createProjectManager({ onStatusChange = () => {} } = {}) {
  const states = new Map();

  function getState(id) {
    if (!states.has(id)) {
      states.set(id, {
        child: null,
        pid: null,
        startedAt: null,
        exitCode: null,
        restarts: 0,
        status: 'stopped',
        stopRequested: false,
        stoppedAt: 0,
        everStarted: false,
        busy: false,
        exited: null,
        tailer: null,
        buffer: createLogBuffer(),
      });
    }
    return states.get(id);
  }

  function isRunning(state) {
    return state.child !== null;
  }

  async function handleExit(project, state, code, signal) {
    const status = !state.stopRequested && (signal || code !== 0) ? 'crashed' : 'stopped';
    state.child = null;
    state.pid = null;
    state.exitCode = typeof code === 'number' ? code : null;
    state.status = status;
    // Take the tailer first: a new start may set its own while the last output is read.
    const { tailer } = state;
    state.tailer = null;
    await tailer?.stop();
    const reason = signal ? `signal ${signal}` : `code ${code}`;
    const stream = status === 'crashed' ? 'stderr' : 'stdout';
    state.buffer.note(stream, `${AGENT_NOTE} process exited with ${reason}`);
    console.log(`[agent] project ${project.id} ${status} (${reason})`);
    onStatusChange(project.id);
  }

  async function checkPortFree(project, state) {
    if (!project.port || Date.now() - state.stoppedAt < RECENT_STOP_MS) {
      return null;
    }
    const ports = await listListeningPorts();
    const used = ports.find((entry) => entry.port === project.port);
    if (!used) {
      return null;
    }
    const owner = used.process ? `${used.process} (PID ${used.pid})` : `PID ${used.pid}`;
    return `Port ${project.port} is already used by ${owner}`;
  }

  async function startProject(project) {
    const state = getState(project.id);
    if (isRunning(state)) {
      return reply(false, 'Already running');
    }
    if (!(await isDirectory(project.cwd))) {
      return reply(false, `Folder not found: ${project.cwd}`);
    }
    const portProblem = await checkPortFree(project, state);
    if (portProblem) {
      return reply(false, portProblem);
    }

    const files = outputFiles(project.id);
    let child;
    let fds;
    try {
      fds = openOutputFiles(files);
      const { file, args, options } = buildSpawn(project, ['ignore', fds.stdout, fds.stderr]);
      child = spawn(file, args, options);
    } catch (error) {
      return reply(false, `Could not start: ${error.message}`);
    } finally {
      // The child has its own copies of the file handles.
      for (const fd of Object.values(fds ?? {})) {
        closeSync(fd);
      }
    }

    // Spawn errors (for example an unknown program) arrive as an event, followed by no exit.
    const spawnError = new Promise((resolve) => child.once('error', resolve));
    if (!child.pid) {
      const error = await spawnError;
      return reply(false, `Could not start ${project.command[0]}: ${error.code ?? error.message}`);
    }
    child.on('error', () => {});

    if (state.everStarted) {
      state.restarts += 1;
    }
    Object.assign(state, {
      child,
      pid: child.pid,
      startedAt: new Date().toISOString(),
      exitCode: null,
      status: 'running',
      stopRequested: false,
      everStarted: true,
      tailer: createOutputTailer(files, state.buffer),
    });
    state.exited = new Promise((resolve) => {
      child.once('exit', (code, signal) => {
        handleExit(project, state, code, signal).finally(resolve);
      });
    });
    const commandLine = project.command.join(' ');
    state.buffer.note('stdout', `${AGENT_NOTE} started ${commandLine} (PID ${child.pid})`);
    console.log(`[agent] project ${project.id} started (PID ${child.pid})`);
    onStatusChange(project.id);

    // Report a project that dies right away (bad command, port in use) as a failed start.
    await waitWithTimeout(state.exited, START_CHECK_MS);
    if (state.status === 'crashed') {
      const detail = lastStderrText(state.buffer);
      return reply(false, `Exited right away with code ${state.exitCode}${detail}`);
    }
    return reply(true, `Started (PID ${state.pid ?? child.pid})`);
  }

  async function stopProject(project) {
    const state = getState(project.id);
    if (!isRunning(state)) {
      return reply(false, 'Not running (only projects started from the dashboard can be stopped)');
    }
    state.stopRequested = true;
    await killTree(state.pid);
    const stopped = await waitWithTimeout(state.exited, STOP_WAIT_MS);
    if (!stopped) {
      return reply(false, 'The project did not stop within 10 seconds');
    }
    state.stoppedAt = Date.now();
    return reply(true, 'Stopped');
  }

  async function restartProject(project) {
    const state = getState(project.id);
    if (isRunning(state)) {
      const result = await stopProject(project);
      if (!result.ok) {
        return result;
      }
    }
    return startProject(project);
  }

  const ACTIONS = { start: startProject, stop: stopProject, restart: restartProject };

  return {
    // Runs one action at a time per project.
    async runAction(project, action) {
      const state = getState(project.id);
      if (state.busy) {
        return reply(false, 'Another action is still running for this project');
      }
      state.busy = true;
      try {
        return await ACTIONS[action](project);
      } finally {
        state.busy = false;
      }
    },

    logs(id, count) {
      return getState(id).buffer.tail(count);
    },

    // Status of one configured project. `listeners` are the listening ports on its port.
    describe(project, listeners) {
      const state = getState(project.id);
      const running = isRunning(state);
      let status = state.status;
      let pid = state.pid;
      if (!running && status !== 'crashed' && listeners.length > 0) {
        status = 'external';
        pid = listeners[0].pid ?? null;
      }
      return {
        id: project.id,
        name: project.name,
        type: project.type,
        port: project.port,
        status,
        pid,
        startedAt: running ? state.startedAt : null,
        exitCode: state.exitCode,
        restarts: state.restarts,
        errorCount: state.buffer.errorCount(),
        hasLogFile: project.logFile !== null,
      };
    },
  };
}
