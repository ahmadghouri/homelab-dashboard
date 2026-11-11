import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Reads and validates agent settings once at startup.

// The agent folder (one level above src/). Relative paths in settings are resolved against it.
const AGENT_DIR = fileURLToPath(new URL('..', import.meta.url));

function toPositiveInt(value, fallback, name) {
  const number = Number(value ?? fallback);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
  return number;
}

function toPort(value, fallback, name) {
  const number = Number(value?.trim() || fallback);
  if (!Number.isInteger(number) || number < 1 || number > 65535) {
    throw new Error(`Invalid ${name}: ${value} (use a whole number from 1 to 65535)`);
  }
  return number;
}

// Accepts only the two listed values (case insensitive), so a typo fails loudly instead of
// silently turning a feature on or off.
function toFlag(value, onValue, offValue, name) {
  const text = (value?.trim() || offValue).toLowerCase();
  if (text !== onValue && text !== offValue) {
    throw new Error(`Invalid ${name}: ${value} (use ${onValue} or ${offValue})`);
  }
  return text === onValue;
}

const multiLinkHttpPort = toPort(process.env.MULTILINK_HTTP_PORT, 8080, 'MULTILINK_HTTP_PORT');
const multiLinkSocksPort = toPort(process.env.MULTILINK_SOCKS_PORT, 1080, 'MULTILINK_SOCKS_PORT');
if (multiLinkHttpPort === multiLinkSocksPort) {
  throw new Error('MULTILINK_HTTP_PORT and MULTILINK_SOCKS_PORT must be different');
}

export const config = Object.freeze({
  serverUrl: process.env.SERVER_URL ?? 'http://localhost:4000',
  agentToken: process.env.AGENT_TOKEN ?? '',
  metricsIntervalMs: toPositiveInt(process.env.METRICS_INTERVAL_MS, 5000, 'METRICS_INTERVAL_MS'),
  // Lock / restart / shutdown from the dashboard. Off unless explicitly turned on.
  remoteCommands: toFlag(process.env.REMOTE_COMMANDS, 'on', 'off', 'REMOTE_COMMANDS'),
  remoteCommandsDryRun: toFlag(
    process.env.REMOTE_COMMANDS_DRY_RUN,
    'true',
    'false',
    'REMOTE_COMMANDS_DRY_RUN',
  ),
  // Dev projects and services of this PC (see workspace.example.json). A missing file is fine.
  workspaceFile: path.resolve(AGENT_DIR, process.env.WORKSPACE_FILE?.trim() || 'workspace.json'),
  // Start / stop / logs from the dashboard. Off unless explicitly turned on; status is always sent.
  workspaceControl: toFlag(process.env.WORKSPACE_CONTROL, 'on', 'off', 'WORKSPACE_CONTROL'),
  // Local load-balancing proxy over all internet lines. Off unless explicitly turned on;
  // detected lines and their health are always reported.
  multiLink: toFlag(process.env.MULTILINK, 'on', 'off', 'MULTILINK'),
  multiLinkHttpPort,
  multiLinkSocksPort,
});
