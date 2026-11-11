import os from 'node:os';
import { config } from './config.js';

// M0 skeleton. Metrics collection and the Socket.io connection are added in M2.
console.log('[agent] Homelab agent starting');
console.log(`[agent] host: ${os.hostname()} (${os.platform()} ${os.release()})`);
console.log(`[agent] server: ${config.serverUrl}`);

if (!config.agentToken) {
  console.warn('[agent] AGENT_TOKEN is empty. Add this device in the dashboard to get a token (M2).');
}
