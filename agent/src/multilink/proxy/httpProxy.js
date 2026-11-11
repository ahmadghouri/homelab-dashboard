import http from 'node:http';
import { bridgeSockets, connectUpstream, isValidHost, isValidPort } from './connectUpstream.js';

// HTTP proxy: CONNECT tunnels (HTTPS and anything else) and plain http:// requests with an absolute URL.
// Nothing about the request (URL, headers, body) is logged.

const HEADERS_TIMEOUT_MS = 30_000;
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-connection',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

const BAD_GATEWAY_REPLY = 'HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\nConnection: close\r\n\r\n';
const BAD_REQUEST_REPLY = 'HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\nConnection: close\r\n\r\n';
const TUNNEL_READY_REPLY = 'HTTP/1.1 200 Connection Established\r\n\r\n';

// Parses "host:port" or "[ipv6]:port" from a CONNECT request.
export function parseConnectTarget(text) {
  const match = /^\[([0-9a-fA-F:.]+)\]:(\d{1,5})$/.exec(text ?? '') ?? /^([^:[\]]+):(\d{1,5})$/.exec(text ?? '');
  if (!match) {
    return null;
  }
  const host = match[1];
  const port = Number(match[2]);
  return isValidHost(host) && isValidPort(port) ? { host, port } : null;
}

// Parses an absolute http:// URL from a proxy request; other forms are not proxied here.
export function parseHttpTarget(text) {
  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:') {
    return null;
  }
  const host = url.hostname.replace(/^\[(.*)\]$/, '$1');
  const port = url.port ? Number(url.port) : 80;
  if (!isValidHost(host) || !isValidPort(port)) {
    return null;
  }
  return { host, port, path: `${url.pathname}${url.search}` };
}

// Drops hop-by-hop headers, every Proxy-* header and headers named in Connection.
// Takes and returns Node's flat raw header list ([name, value, name, value, ...]).
export function filterHeaders(rawHeaders) {
  const named = new Set();
  for (let i = 0; i < rawHeaders.length; i += 2) {
    if (rawHeaders[i].toLowerCase() === 'connection') {
      rawHeaders[i + 1].split(',').forEach((token) => named.add(token.trim().toLowerCase()));
    }
  }
  const result = [];
  for (let i = 0; i < rawHeaders.length; i += 2) {
    const name = rawHeaders[i].toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(name) || named.has(name) || name.startsWith('proxy-')) {
      continue;
    }
    result.push(rawHeaders[i], rawHeaders[i + 1]);
  }
  return result;
}

function sendStatus(res, status) {
  if (res.headersSent) {
    res.destroy();
    return;
  }
  res.writeHead(status, { 'content-length': 0, connection: 'close' });
  res.end();
}

function handleConnect(req, clientSocket, head, context) {
  const target = parseConnectTarget(req.url);
  if (!target) {
    clientSocket.end(BAD_REQUEST_REPLY);
    return;
  }
  // The client may give up while the upstream connection is being opened.
  clientSocket.on('error', () => clientSocket.destroy());
  connectUpstream({ ...target, selector: context.selector, usage: context.usage })
    .then(({ socket }) => {
      if (clientSocket.destroyed) {
        socket.destroy();
        return;
      }
      context.trackUpstream(socket);
      clientSocket.write(TUNNEL_READY_REPLY);
      if (head?.length) {
        socket.write(head);
      }
      bridgeSockets(clientSocket, socket);
    })
    .catch(() => {
      if (!clientSocket.destroyed) {
        clientSocket.end(BAD_GATEWAY_REPLY);
      }
    });
}

async function handleRequest(req, res, context) {
  const target = parseHttpTarget(req.url);
  if (!target) {
    sendStatus(res, 400);
    return;
  }
  let upstream;
  try {
    ({ socket: upstream } = await connectUpstream({ ...target, selector: context.selector, usage: context.usage }));
  } catch {
    sendStatus(res, 502);
    return;
  }
  if (res.destroyed) {
    upstream.destroy();
    return;
  }
  context.trackUpstream(upstream);
  const headers = filterHeaders(req.rawHeaders);
  // One upstream connection per request keeps every request on the line chosen for it.
  headers.push('Connection', 'close');
  const proxyReq = http.request({
    method: req.method,
    path: target.path,
    headers,
    setHost: false,
    createConnection: () => upstream,
  });
  proxyReq.on('response', (upstreamRes) => {
    res.writeHead(upstreamRes.statusCode, upstreamRes.statusMessage, filterHeaders(upstreamRes.rawHeaders));
    upstreamRes.pipe(res);
    upstreamRes.on('error', () => res.destroy());
  });
  proxyReq.on('error', () => sendStatus(res, 502));
  res.on('close', () => {
    if (!res.writableFinished) {
      proxyReq.destroy();
    }
    upstream.destroy();
  });
  req.pipe(proxyReq);
}

/**
 * Creates (does not start) the HTTP proxy server.
 * `context` = { selector, usage, trackUpstream(socket) }.
 */
export function createHttpProxy(context) {
  const server = http.createServer();
  server.headersTimeout = HEADERS_TIMEOUT_MS;
  // Uploads through the proxy can take long; idle connections are still closed by keepAliveTimeout.
  server.requestTimeout = 0;
  server.on('request', (req, res) => {
    handleRequest(req, res, context).catch(() => sendStatus(res, 502));
  });
  server.on('connect', (req, socket, head) => handleConnect(req, socket, head, context));
  return server;
}
