import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { registerAgentNamespace } from './agentNamespace.js';
import { registerDashboardNamespace } from './dashboardNamespace.js';

// Ping every 10s and drop after 10s without a reply, so a PC that loses power
// is marked offline within about 20 seconds.
const PING_INTERVAL_MS = 10_000;
const PING_TIMEOUT_MS = 10_000;
const MAX_MESSAGE_BYTES = 64 * 1024;

export function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.clientOrigin, credentials: true },
    pingInterval: PING_INTERVAL_MS,
    pingTimeout: PING_TIMEOUT_MS,
    maxHttpBufferSize: MAX_MESSAGE_BYTES,
  });

  registerDashboardNamespace(io);
  registerAgentNamespace(io);
  return io;
}
