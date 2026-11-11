import { io } from 'socket.io-client';
import pkg from '../package.json' with { type: 'json' };
import { createMetricsCollector } from './collectors/metrics.js';
import { collectSystemInfo } from './collectors/systemInfo.js';
import { config } from './config.js';

const RECONNECT_MAX_DELAY_MS = 30_000;

if (!config.agentToken) {
  console.error('[agent] AGENT_TOKEN is missing. Add this PC in the dashboard (Devices > Add device)');
  console.error('[agent] and put the token in agent/.env');
  process.exit(1);
}

console.log(`[agent] Homelab agent v${pkg.version} starting, server: ${config.serverUrl}`);

const socket = io(`${config.serverUrl}/agent`, {
  auth: { token: config.agentToken },
  reconnectionDelayMax: RECONNECT_MAX_DELAY_MS,
});

const collectMetrics = createMetricsCollector();
let isCollecting = false;

async function sendMetrics() {
  // Skip a tick instead of overlapping when collection is slow.
  if (!socket.connected || isCollecting) {
    return;
  }
  isCollecting = true;
  try {
    socket.emit('agent:metrics', await collectMetrics());
  } catch (error) {
    console.error('[agent] could not collect metrics:', error.message);
  } finally {
    isCollecting = false;
  }
}

socket.on('connect', async () => {
  console.log('[agent] connected');
  try {
    socket.emit('agent:hello', await collectSystemInfo(pkg.version));
  } catch (error) {
    console.error('[agent] could not collect system info:', error.message);
  }
  sendMetrics();
});

socket.on('disconnect', (reason) => {
  console.warn(`[agent] disconnected (${reason}), retrying`);
  // The server closes the socket when the token is regenerated or the device is deleted.
  // Socket.io does not reconnect by itself in that case, so try again (and fail if the token is no longer valid).
  if (reason === 'io server disconnect') {
    setTimeout(() => socket.connect(), RECONNECT_MAX_DELAY_MS);
  }
});

socket.on('connect_error', (error) => {
  console.warn(`[agent] cannot connect: ${error.message}`);
  if (!socket.active) {
    // Rejected by the server (for example an invalid token). Retry slowly.
    setTimeout(() => socket.connect(), RECONNECT_MAX_DELAY_MS);
  }
});

setInterval(sendMetrics, config.metricsIntervalMs);

function shutdown() {
  console.log('[agent] stopping');
  socket.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
