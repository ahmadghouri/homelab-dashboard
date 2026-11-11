import net from 'node:net';

// Probes one target (HTTP request or TCP connect) and reports whether it is up.

const MAX_BODY_BYTES = 1024 * 1024;
const USER_AGENT = 'HomelabDashboard/1.0';
const TCP_TARGET = /^(\[[0-9a-fA-F:.]+\]|[A-Za-z0-9.-]{1,253}):(\d{1,5})$/;

// Returns { host, port } for "host:port" (IPv6 in brackets), or null when it is not valid.
export function parseTcpTarget(target) {
  const match = TCP_TARGET.exec(target);
  if (!match) {
    return null;
  }
  const port = Number(match[2]);
  if (port < 1 || port > 65535) {
    return null;
  }
  return { host: match[1].replace(/^\[|\]$/g, ''), port };
}

function isHttpUrl(target) {
  try {
    const url = new URL(target);
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

// Returns an error message when the target does not match the type, otherwise null.
export function targetError(type, target) {
  if (type === 'http') {
    return isHttpUrl(target) ? null : 'Use http:// or https://';
  }
  return parseTcpTarget(target) ? null : 'Use host:port, port 1 to 65535';
}

// Reads and drops the body (up to the cap) so the connection is released.
async function discardBody(response) {
  if (!response.body) {
    return;
  }
  const reader = response.body.getReader();
  let received = 0;
  try {
    while (received < MAX_BODY_BYTES) {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }
      received += value.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}

function describeFetchError(error, timeoutMs) {
  if (error.name === 'TimeoutError' || error.name === 'AbortError') {
    return `Timed out after ${timeoutMs} ms`;
  }
  return error.cause?.code ?? error.cause?.message ?? error.message;
}

async function checkHttp(target, timeoutMs) {
  const startedAt = performance.now();
  try {
    const response = await fetch(target, {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': USER_AGENT },
    });
    const responseMs = Math.round(performance.now() - startedAt);
    // A slow or broken body does not change the result: the status already arrived.
    await discardBody(response).catch(() => {});
    const up = response.status < 400;
    return {
      up,
      responseMs,
      statusCode: response.status,
      error: up ? null : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      up: false,
      responseMs: Math.round(performance.now() - startedAt),
      statusCode: null,
      error: describeFetchError(error, timeoutMs),
    };
  }
}

function checkTcp(target, timeoutMs) {
  const { host, port } = parseTcpTarget(target);
  const startedAt = performance.now();
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const finish = (up, error) => {
      socket.destroy();
      resolve({
        up,
        responseMs: Math.round(performance.now() - startedAt),
        statusCode: null,
        error,
      });
    };
    socket.setTimeout(timeoutMs, () => finish(false, `Timed out after ${timeoutMs} ms`));
    socket.once('connect', () => finish(true, null));
    socket.once('error', (error) => finish(false, error.code ?? error.message));
  });
}

// service: { type, target, timeoutMs }. Never throws.
// Returns { up, responseMs, statusCode, error }.
export function probeService({ type, target, timeoutMs }) {
  return type === 'http' ? checkHttp(target, timeoutMs) : checkTcp(target, timeoutMs);
}
