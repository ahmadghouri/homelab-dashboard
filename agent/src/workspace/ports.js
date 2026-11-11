// Lists the TCP ports this PC is listening on, with the PID and process name behind each one.
// Windows: netstat + tasklist. Linux: ss. Other systems: empty list.
// Never throws: when a tool is missing or its output is unexpected the result is an empty list.
import { execFile } from 'node:child_process';

const EXEC_TIMEOUT_MS = 10_000;
const TASKLIST_TIMEOUT_MS = 90_000;
const NAME_WAIT_MS = 3000;
const MAX_BUFFER_BYTES = 8 * 1024 * 1024;
const MAX_PORTS = 300;
const CACHE_MS = 5000;

function run(file, args, timeout = EXEC_TIMEOUT_MS) {
  return new Promise((resolve) => {
    execFile(
      file,
      args,
      { timeout, windowsHide: true, maxBuffer: MAX_BUFFER_BYTES },
      (error, stdout) => resolve(error ? null : String(stdout)),
    );
  });
}

function toPort(text) {
  const port = Number(text);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : null;
}

function toPid(text) {
  const pid = Number(text);
  return Number.isInteger(pid) && pid >= 0 ? pid : null;
}

// Splits "0.0.0.0:80", "[::1]:5173", "*:22" or "127.0.0.53%lo:53" into address and port.
export function splitAddress(text) {
  const index = text.lastIndexOf(':');
  if (index <= 0) {
    return null;
  }
  const port = toPort(text.slice(index + 1));
  if (port === null) {
    return null;
  }
  let address = text.slice(0, index).replace(/^\[/, '').replace(/\]$/, '');
  address = address.replace(/%.*$/, '');
  return { address: address || '*', port };
}

// netstat -ano lines: "  TCP    0.0.0.0:135    0.0.0.0:0    LISTENING    1234".
// The state word is translated on non-English Windows, so a listening socket is recognised by its
// foreign port 0 as well ("0.0.0.0:0" or "[::]:0").
export function parseNetstat(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 5 || cols[0].toUpperCase() !== 'TCP') {
      continue;
    }
    const local = splitAddress(cols[1]);
    const foreignPort = cols[2].slice(cols[2].lastIndexOf(':') + 1);
    const listening = cols[3].toUpperCase() === 'LISTENING' || foreignPort === '0' || foreignPort === '*';
    const pid = toPid(cols[cols.length - 1]);
    // PID 0 (System Idle Process) never owns a real listening socket.
    if (local && listening && pid !== null && pid !== 0) {
      rows.push({ port: local.port, address: local.address, pid, process: null });
    }
  }
  return rows;
}

// tasklist /fo csv /nh lines: "node.exe","1234","Console","1","50,000 K". Returns Map(pid -> name).
export function parseTasklist(text) {
  const names = new Map();
  for (const line of text.split(/\r?\n/)) {
    const fields = [...line.matchAll(/"([^"]*)"/g)].map((match) => match[1]);
    const pid = fields.length >= 2 ? toPid(fields[1]) : null;
    if (pid !== null && fields[0]) {
      names.set(pid, fields[0]);
    }
  }
  return names;
}

// ss -ltnpH lines: "LISTEN 0 511 0.0.0.0:80 0.0.0.0:* users:(("nginx",pid=1234,fd=6))".
// Without root the users:(...) part is missing for processes of other users; pid and process stay null.
export function parseSs(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 5 || cols[0] !== 'LISTEN') {
      continue;
    }
    const local = splitAddress(cols[3]);
    if (!local) {
      continue;
    }
    const owner = line.match(/\("([^"]+)",pid=(\d+)/);
    rows.push({
      port: local.port,
      address: local.address,
      pid: owner ? toPid(owner[2]) : null,
      process: owner ? owner[1] : null,
    });
  }
  return rows;
}

// Keeps the first row per port + address, sorted by port, at most MAX_PORTS rows.
export function dedupePorts(rows) {
  const byKey = new Map();
  for (const row of rows) {
    const key = `${row.port}|${row.address}`;
    if (!byKey.has(key)) {
      byKey.set(key, row);
    }
  }
  return [...byKey.values()]
    .sort((a, b) => a.port - b.port || (a.address < b.address ? -1 : Number(a.address > b.address)))
    .slice(0, MAX_PORTS);
}

// Process names by PID. A full tasklist can take from 1 s to more than 40 s on a busy PC, so it runs in
// the background: a call waits at most NAME_WAIT_MS for it and otherwise returns null names for new PIDs,
// which the next call fills in. A PID keeps its name while the process lives, so the map is reused.
let processNames = new Map();
let namesRefresh = null;

function refreshProcessNames() {
  namesRefresh ??= run('tasklist', ['/fo', 'csv', '/nh'], TASKLIST_TIMEOUT_MS).then((output) => {
    if (output) {
      processNames = parseTasklist(output);
    }
    namesRefresh = null;
  });
  return namesRefresh;
}

async function lookupNames(pids) {
  if (pids.some((pid) => !processNames.has(pid))) {
    const waitLimit = new Promise((resolve) => setTimeout(resolve, NAME_WAIT_MS).unref());
    await Promise.race([refreshProcessNames(), waitLimit]);
  }
  return processNames;
}

async function listWindows() {
  const netstat = await run('netstat', ['-ano']);
  if (!netstat) {
    return [];
  }
  const rows = parseNetstat(netstat);
  const names = await lookupNames([...new Set(rows.map((row) => row.pid))]);
  return rows.map((row) => ({ ...row, process: names.get(row.pid) ?? null }));
}

async function listLinux() {
  const output = await run('ss', ['-ltnpH']);
  return output ? parseSs(output) : [];
}

async function readPorts() {
  try {
    if (process.platform === 'win32') {
      return dedupePorts(await listWindows());
    }
    if (process.platform === 'linux') {
      return dedupePorts(await listLinux());
    }
    return [];
  } catch {
    return [];
  }
}

let cached = { at: 0, ports: null };
let inFlight = null;

// Returns [{ port, address, pid, process }]. A result is reused for 5 s after it finished and concurrent
// callers share one run.
export function listListeningPorts() {
  if (cached.ports && Date.now() - cached.at < CACHE_MS) {
    return Promise.resolve(cached.ports);
  }
  inFlight ??= readPorts().then((ports) => {
    cached = { at: Date.now(), ports };
    inFlight = null;
    return ports;
  });
  return inFlight;
}
