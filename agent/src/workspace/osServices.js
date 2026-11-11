// Status and start / stop / restart of OS services listed in workspace.json.
// Windows: sc.exe. Linux: systemctl. Other systems: status 'unknown', actions not supported.
// Never throws: failures come back as status 'unknown' or { ok: false, output }.
import { execFile } from 'node:child_process';

const EXEC_TIMEOUT_MS = 15_000;
const MAX_OUTPUT_LENGTH = 500;
const STOP_WAIT_MS = 20_000;
const STOP_POLL_MS = 500;
const ACTIONS = ['start', 'stop', 'restart'];
// Windows service names and systemd unit names (letters, digits, - _ . @). The first character must not be
// '-' so a name can never be read as a command line option.
const SERVICE_NAME_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.@-]{0,99}$/;

const NEEDS_ADMIN_MESSAGE = 'Needs administrator rights';
const NOT_FOUND_MESSAGE = 'Service not found on this PC';

// Windows sc.exe error codes.
const SC_ACCESS_DENIED = 5;
const SC_ALREADY_RUNNING = 1056;
const SC_DOES_NOT_EXIST = 1060;
const SC_NOT_STARTED = 1062;
// sc query STATE codes.
const SC_STATE_STOPPED = 1;
const SC_STATE_RUNNING = 4;

function run(file, args) {
  return new Promise((resolve) => {
    execFile(file, args, { timeout: EXEC_TIMEOUT_MS, windowsHide: true }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        exitCode: error ? (typeof error.code === 'number' ? error.code : null) : 0,
        notInstalled: error?.code === 'ENOENT',
        output: `${stdout ?? ''}\n${stderr ?? ''}`.trim() || (error ? error.message : ''),
      });
    });
  });
}

function reply(ok, output) {
  return { ok, output: String(output).trim().slice(0, MAX_OUTPUT_LENGTH) };
}

function isValidServiceName(name) {
  return typeof name === 'string' && SERVICE_NAME_PATTERN.test(name);
}

// sc prints "FAILED 1060:" style codes; the exit code is the same number. Both are checked.
function scErrorCode(result) {
  const match = result.output.match(/FAILED\s+(\d+)/i);
  if (match) {
    return Number(match[1]);
  }
  return result.ok ? null : result.exitCode;
}

// Parses `sc query <name>` output. The STATE number is used because the words are translated on
// non-English Windows.
export function parseScQuery(result) {
  if (scErrorCode(result) === SC_DOES_NOT_EXIST) {
    return 'not_found';
  }
  const match = result.output.match(/STATE\s*:\s*(\d+)/);
  if (!match) {
    return 'unknown';
  }
  const state = Number(match[1]);
  if (state === SC_STATE_RUNNING) {
    return 'running';
  }
  if (state === SC_STATE_STOPPED) {
    return 'stopped';
  }
  return 'unknown';
}

// Parses `systemctl show --property=LoadState,ActiveState <unit>` output ("LoadState=loaded\nActiveState=active").
export function parseSystemctlShow(text) {
  const values = Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.trim().split('='))
      .filter((parts) => parts.length === 2),
  );
  if (values.LoadState === 'not-found') {
    return 'not_found';
  }
  if (values.ActiveState === 'active' || values.ActiveState === 'reloading') {
    return 'running';
  }
  if (values.ActiveState === 'inactive' || values.ActiveState === 'failed') {
    return 'stopped';
  }
  return 'unknown';
}

async function readStatus(serviceName) {
  if (!isValidServiceName(serviceName)) {
    return 'unknown';
  }
  if (process.platform === 'win32') {
    return parseScQuery(await run('sc', ['query', serviceName]));
  }
  if (process.platform === 'linux') {
    const result = await run('systemctl', ['show', '--property=LoadState,ActiveState', serviceName]);
    return result.ok ? parseSystemctlShow(result.output) : 'unknown';
  }
  return 'unknown';
}

// services: [{ id, name, serviceName, port }] from workspace.json.
// Returns [{ id, name, serviceName, port, status: 'running' | 'stopped' | 'not_found' | 'unknown' }].
export async function getServiceStatuses(services) {
  const list = Array.isArray(services) ? services : [];
  return Promise.all(
    list.map(async (service) => {
      let status = 'unknown';
      try {
        status = await readStatus(service?.serviceName);
      } catch {
        status = 'unknown';
      }
      return {
        id: service?.id ?? null,
        name: service?.name ?? null,
        serviceName: service?.serviceName ?? null,
        port: service?.port ?? null,
        status,
      };
    }),
  );
}

// Explains an sc start / stop result in plain words.
export function describeScResult(result, action) {
  const code = scErrorCode(result);
  if (code === SC_ACCESS_DENIED) {
    return reply(false, NEEDS_ADMIN_MESSAGE);
  }
  if (code === SC_DOES_NOT_EXIST) {
    return reply(false, NOT_FOUND_MESSAGE);
  }
  if (code === SC_ALREADY_RUNNING && action === 'start') {
    return reply(true, 'Service is already running');
  }
  if (code === SC_NOT_STARTED && action === 'stop') {
    return reply(true, 'Service is already stopped');
  }
  if (result.notInstalled) {
    return reply(false, 'sc.exe is not available on this PC');
  }
  if (!result.ok) {
    return reply(false, result.output || `Could not ${action} the service`);
  }
  return reply(true, action === 'start' ? 'Service is starting' : 'Service is stopping');
}

async function waitForWindowsStop(serviceName) {
  const deadline = Date.now() + STOP_WAIT_MS;
  while (Date.now() < deadline) {
    if (parseScQuery(await run('sc', ['query', serviceName])) === 'stopped') {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, STOP_POLL_MS));
  }
  return false;
}

async function windowsAction(serviceName, action) {
  if (action !== 'restart') {
    return describeScResult(await run('sc', [action, serviceName]), action);
  }
  const stopped = describeScResult(await run('sc', ['stop', serviceName]), 'stop');
  if (!stopped.ok) {
    return stopped;
  }
  if (!(await waitForWindowsStop(serviceName))) {
    return reply(false, 'Service did not stop within 20 seconds');
  }
  const started = describeScResult(await run('sc', ['start', serviceName]), 'start');
  return started.ok ? reply(true, 'Service is restarting') : started;
}

// Explains a systemctl start / stop / restart result in plain words.
export function describeSystemctlResult(result, action) {
  if (result.ok) {
    return reply(true, `Service ${action} done`);
  }
  if (result.notInstalled) {
    return reply(false, 'systemctl is not available on this PC');
  }
  if (/access denied|authentication is required|interactive authentication|not permitted/i.test(result.output)) {
    return reply(false, NEEDS_ADMIN_MESSAGE);
  }
  if (/not found|not loaded|could not be found/i.test(result.output)) {
    return reply(false, NOT_FOUND_MESSAGE);
  }
  return reply(false, result.output || `Could not ${action} the service`);
}

// service: { serviceName } from workspace.json. action: 'start' | 'stop' | 'restart'. Returns { ok, output }.
export async function serviceAction(service, action) {
  if (!ACTIONS.includes(action)) {
    return reply(false, 'Unknown action');
  }
  const serviceName = service?.serviceName;
  if (!isValidServiceName(serviceName)) {
    return reply(false, 'Invalid service name');
  }
  try {
    if (process.platform === 'win32') {
      return await windowsAction(serviceName, action);
    }
    if (process.platform === 'linux') {
      return describeSystemctlResult(
        await run('systemctl', ['--no-ask-password', action, serviceName]),
        action,
      );
    }
    return reply(false, 'Service control is not supported on this operating system');
  } catch (error) {
    return reply(false, error.message);
  }
}
