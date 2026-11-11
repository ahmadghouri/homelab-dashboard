import { createHttpProxy } from './httpProxy.js';
import { createSocksProxy } from './socksProxy.js';

// Starts the local load-balancing proxies (HTTP and SOCKS5) on 127.0.0.1 only.
// A port problem is reported in status().error; it never stops the agent.

const LISTEN_HOST = '127.0.0.1';
const MAX_CLIENT_CONNECTIONS = 4096;

function describeListenError(error, port) {
  if (error.code === 'EADDRINUSE') {
    return `Port ${port} is already in use`;
  }
  if (error.code === 'EACCES') {
    return `Port ${port} cannot be used (permission denied)`;
  }
  return `Port ${port} failed: ${error.code ?? error.message}`;
}

/**
 * @param {{ httpPort: number, socksPort: number, selector: object, usage: object, logger?: Console }} options
 * @returns {{ stop(): Promise<void>, status(): { listening: boolean, httpPort: number, socksPort: number,
 *   error: string | null }, ready: Promise<void> }}
 *   `listening` is true while at least one of the two proxies accepts connections.
 */
export function startProxy({ httpPort, socksPort, selector, usage, logger = console }) {
  const clientSockets = new Set();
  const upstreamSockets = new Set();
  const errors = new Map();
  const listening = new Set();
  let stopped = false;

  function trackSocket(set, socket) {
    set.add(socket);
    socket.once('close', () => set.delete(socket));
  }

  const context = { selector, usage, trackUpstream: (socket) => trackSocket(upstreamSockets, socket) };
  const servers = [
    { name: 'HTTP', port: httpPort, server: createHttpProxy(context) },
    { name: 'SOCKS5', port: socksPort, server: createSocksProxy(context) },
  ];

  function listen({ name, port, server }) {
    server.maxConnections = MAX_CLIENT_CONNECTIONS;
    server.on('connection', (socket) => trackSocket(clientSockets, socket));
    return new Promise((resolve) => {
      server.once('listening', () => {
        listening.add(name);
        logger.log?.(`[agent] multilink ${name} proxy listening on ${LISTEN_HOST}:${port}`);
        resolve();
      });
      server.on('error', (error) => {
        listening.delete(name);
        errors.set(name, describeListenError(error, port));
        logger.warn?.(`[agent] multilink ${name} proxy: ${errors.get(name)}`);
        resolve();
      });
      server.listen({ host: LISTEN_HOST, port, exclusive: true });
    });
  }

  let ready;
  if (httpPort === socksPort) {
    errors.set('HTTP', `HTTP and SOCKS proxies cannot share port ${httpPort}`);
    ready = Promise.resolve();
  } else {
    ready = Promise.all(servers.map(listen)).then(() => undefined);
  }

  function status() {
    return {
      listening: !stopped && listening.size > 0,
      httpPort,
      socksPort,
      error: errors.size > 0 ? [...errors.values()].join('; ') : null,
    };
  }

  // Closes both servers and every open connection.
  async function stop() {
    if (stopped) {
      return;
    }
    stopped = true;
    await ready;
    const closing = servers
      .filter(({ server }) => server.listening)
      .map(({ server }) => new Promise((resolve) => server.close(() => resolve())));
    for (const socket of [...clientSockets, ...upstreamSockets]) {
      socket.destroy();
    }
    listening.clear();
    await Promise.all(closing);
  }

  return { stop, status, ready };
}
