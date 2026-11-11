import { io } from 'socket.io-client';
import pkg from '../package.json' with { type: 'json' };
import { createMetricsCollector } from './collectors/metrics.js';
import { runRemoteCommand } from './commands/runCommand.js';
import { collectSystemInfo } from './collectors/systemInfo.js';
import { config } from './config.js';
import { registerMultiLink } from './multilink/index.js';
import { registerWorkspace } from './workspace/index.js';

const RECONNECT_MAX_DELAY_MS = 30_000;

if (!config.agentToken) {
  console.error(
    '[agent] AGENT_TOKEN is missing. Add this PC in the dashboard (Devices > Add device)',
  );
  console.error('[agent] and put the token in agent/.env');
  process.exit(1);
}

console.log(`[agent] Homelab agent v${pkg.version} starting, server: ${config.serverUrl}`);
console.log(
  `[agent] remote commands: ${config.remoteCommands ? 'on' : 'off'}${
    config.remoteCommands && config.remoteCommandsDryRun ? ' (dry run)' : ''
  }`,
);
console.log(
  `[agent] workspace control: ${config.workspaceControl ? 'on' : 'off'}, ` +
    `file: ${config.workspaceFile}`,
);
console.log(
  `[agent] multilink: ${
    config.multiLink
      ? `on (proxy 127.0.0.1:${config.multiLinkHttpPort}, SOCKS 127.0.0.1:${config.multiLinkSocksPort})`
      : 'off (lines are reported read-only)'
  }`,
);

const socket = io(`${config.serverUrl}/agent`, {
  auth: { token: config.agentToken },
  reconnectionDelayMax: RECONNECT_MAX_DELAY_MS,
});

registerWorkspace(socket);
const multiLink = registerMultiLink(socket);

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

// The server waits for the acknowledgement, so always answer, even for invalid payloads.
socket.on('agent:command', async (payload, ack) => {
  if (typeof ack !== 'function') {
    return;
  }
  const command = typeof payload?.command === 'string' ? payload.command : '';
  try {
    const result = await runRemoteCommand(command, {
      enabled: config.remoteCommands,
      dryRun: config.remoteCommandsDryRun,
    });
    console.log(`[agent] command "${command.slice(0, 40)}": ${result.ok ? 'ok' : 'failed'}`);
    ack(result);
  } catch (error) {
    console.error('[agent] command failed:', error.message);
    ack({ ok: false, output: 'Agent error' });
  }
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

// Dev projects started from the dashboard keep running after the agent stops (they are not killed).
// The proxy is stopped first (it saves the usage totals); a stuck stop never blocks the exit.
const SHUTDOWN_TIMEOUT_MS = 3000;
let stopping = false;

async function shutdown() {
  if (stopping) {
    return;
  }
  stopping = true;
  console.log('[agent] stopping');
  setTimeout(() => process.exit(0), SHUTDOWN_TIMEOUT_MS).unref();
  await multiLink.stop();
  socket.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
