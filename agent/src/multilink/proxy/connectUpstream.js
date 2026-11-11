import net from 'node:net';

// Opens an outgoing TCP connection on a line chosen by the selector (the socket is bound to the
// line's local IP), retrying on the next line when a line fails. Also joins two sockets into a tunnel.

const CONNECT_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;
// After one side of a tunnel has finished, the other side gets this long to finish too.
const HALF_CLOSED_TIMEOUT_MS = 60_000;
const MAX_HOST_LENGTH = 255;

// Name lookup or address problems: the same on every line, so retrying elsewhere does not help.
const DESTINATION_ERRORS = new Set(['ENOTFOUND', 'EAI_AGAIN', 'EAI_FAIL', 'EAI_NONAME', 'EINVAL', 'EAFNOSUPPORT']);
// The destination answered (and refused), so the line itself works: retry, but do not blame the line.
const REFUSED_ERRORS = new Set(['ECONNREFUSED']);

export function isValidPort(port) {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

export function isValidHost(host) {
  return typeof host === 'string' && host.length > 0 && host.length <= MAX_HOST_LENGTH && !/[\s/\\@]/.test(host);
}

function codedError(message, code) {
  return Object.assign(new Error(message), { code });
}

function openSocket({ host, port, localAddress, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const options = { host, port, localAddress, allowHalfOpen: true };
    if (net.isIPv4(localAddress)) {
      options.family = 4;
    } else if (net.isIPv6(localAddress)) {
      options.family = 6;
    }
    const socket = net.connect(options);
    const timer = setTimeout(() => fail(codedError('Connection timed out', 'ETIMEDOUT')), timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      socket.off('connect', onConnect);
      socket.off('error', fail);
    }
    function onConnect() {
      cleanup();
      resolve(socket);
    }
    function fail(error) {
      cleanup();
      socket.destroy();
      reject(error);
    }
    socket.once('connect', onConnect);
    socket.once('error', fail);
  });
}

/**
 * Connects to host:port through the selected lines (max 3 attempts, 10 s connect timeout each).
 * Resolves `{ socket, line }`; rejects with an error whose `code` is the last socket error code,
 * or 'ENOLINE' when no line can be used.
 */
export async function connectUpstream({
  host,
  port,
  selector,
  usage,
  connectTimeoutMs = CONNECT_TIMEOUT_MS,
  maxAttempts = MAX_ATTEMPTS,
}) {
  if (!isValidHost(host) || !isValidPort(port)) {
    throw codedError('Invalid destination', 'EINVAL');
  }
  const tried = [];
  let lastError = null;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const line = selector.pick({ host, exclude: tried });
    if (!line) {
      break;
    }
    tried.push(line.id);
    try {
      const socket = await openSocket({ host, port, localAddress: line.ip, timeoutMs: connectTimeoutMs });
      selector.reportSuccess?.(line.id);
      usage?.track(line.id, socket);
      return { socket, line };
    } catch (error) {
      lastError = error;
      if (DESTINATION_ERRORS.has(error.code)) {
        break;
      }
      if (!REFUSED_ERRORS.has(error.code)) {
        selector.reportFailure(line.id);
      }
    }
  }
  throw lastError ?? codedError('No internet line is available', 'ENOLINE');
}

// Lets a socket send what it still has buffered, then closes it.
function finishSocket(socket) {
  if (socket.destroyed) {
    return;
  }
  if (socket.writableFinished) {
    socket.destroy();
    return;
  }
  socket.once('finish', () => socket.destroy());
  socket.setTimeout(HALF_CLOSED_TIMEOUT_MS, () => socket.destroy());
  socket.end();
}

// Pipes two sockets into each other. Half-close is passed through. An error on either side destroys
// both; a clean close lets the other side flush first. A side left half-closed too long is dropped.
export function bridgeSockets(a, b) {
  const closeBoth = () => {
    a.destroy();
    b.destroy();
  };
  const onEnd = () => {
    a.setTimeout(HALF_CLOSED_TIMEOUT_MS, closeBoth);
    b.setTimeout(HALF_CLOSED_TIMEOUT_MS, closeBoth);
  };
  for (const [socket, other] of [
    [a, b],
    [b, a],
  ]) {
    socket.setNoDelay(true);
    socket.on('error', closeBoth);
    socket.once('end', onEnd);
    socket.once('close', (hadError) => (hadError ? closeBoth() : finishSocket(other)));
  }
  a.pipe(b);
  b.pipe(a);
}
