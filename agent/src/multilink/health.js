import net from 'node:net';

// Checks each line with short TCP connects bound to the line's own IPv4 address, so the test
// really leaves through that line. Read-only: no data is sent, the socket is closed at once.

export const DEFAULT_HEALTH_TARGETS = Object.freeze([
  { host: '1.1.1.1', port: 443 },
  { host: '1.1.1.1', port: 80 },
]);
const ATTEMPTS = 4;
const ATTEMPT_TIMEOUT_MS = 2000;
const FAILED_ROUNDS_FOR_DOWN = 2;

// Resolves with the connect time in ms, or null on failure / timeout.
export function probe({ host, port, localAddress, timeoutMs = ATTEMPT_TIMEOUT_MS }) {
  return new Promise((resolve) => {
    const startedAt = process.hrtime.bigint();
    const socket = net.connect({ host, port, localAddress });
    let settled = false;

    function finish(result) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(result);
    }

    const timer = setTimeout(() => finish(null), timeoutMs);
    socket.once('connect', () => {
      finish(Number(process.hrtime.bigint() - startedAt) / 1e6);
    });
    socket.once('error', () => finish(null));
  });
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return Math.round(value);
}

// One round: ATTEMPTS sequential connects, alternating over the targets.
export async function checkLine(
  line,
  { targets = DEFAULT_HEALTH_TARGETS, attempts = ATTEMPTS, timeoutMs = ATTEMPT_TIMEOUT_MS } = {},
) {
  const latencies = [];
  for (let index = 0; index < attempts; index += 1) {
    const target = targets[index % targets.length];
    const latency = await probe({ ...target, localAddress: line.ip, timeoutMs });
    if (latency !== null) {
      latencies.push(latency);
    }
  }
  return {
    reachable: latencies.length > 0,
    latencyMs: latencies.length > 0 ? median(latencies) : null,
    lossPct: Math.round(((attempts - latencies.length) / attempts) * 100),
  };
}

// Keeps the health state of every line. A line starts down until its first good round;
// one good round makes it up, two failed rounds in a row make it down.
export function createHealthMonitor({ onLineStatus = () => {}, checkOptions = {} } = {}) {
  const states = new Map();
  let checking = false;

  function get(lineId) {
    return states.get(lineId) ?? { up: false, latencyMs: null, lossPct: null };
  }

  function apply(line, result) {
    const previous = states.get(line.id);
    const failedRounds = result.reachable ? 0 : (previous?.failedRounds ?? 0) + 1;
    let up = previous?.up ?? false;
    if (result.reachable) {
      up = true;
    } else if (failedRounds >= FAILED_ROUNDS_FOR_DOWN || !previous) {
      up = false;
    }
    states.set(line.id, { up, latencyMs: result.latencyMs, lossPct: result.lossPct, failedRounds });
    if (!previous || previous.up !== up) {
      onLineStatus(line, up);
    }
  }

  // Checks all lines in parallel; a round still running makes the next call a no-op.
  async function checkAll(lines) {
    if (checking) {
      return;
    }
    checking = true;
    try {
      const ids = new Set(lines.map((line) => line.id));
      for (const id of states.keys()) {
        if (!ids.has(id)) {
          states.delete(id);
        }
      }
      const results = await Promise.all(lines.map((line) => checkLine(line, checkOptions)));
      lines.forEach((line, index) => apply(line, results[index]));
    } finally {
      checking = false;
    }
  }

  return { get, checkAll };
}
