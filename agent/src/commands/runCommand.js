import { execFile } from 'node:child_process';
import {
  REMOTE_COMMANDS,
  SUCCESS_MESSAGES,
  formatCommandLine,
  getOsCommand,
  getUnsupportedMessage,
} from './osCommands.js';

const MAX_OUTPUT_LENGTH = 500;
const EXEC_TIMEOUT_MS = 10_000;

export const TURNED_OFF_MESSAGE =
  'Remote commands are turned off on this PC (set REMOTE_COMMANDS=on in agent/.env)';

function reply(ok, output) {
  return { ok, output: String(output).trim().slice(0, MAX_OUTPUT_LENGTH) };
}

// execFile runs the program directly (no shell), so arguments cannot be injected.
function execOsCommand({ file, args }) {
  return new Promise((resolve) => {
    execFile(
      file,
      args,
      { timeout: EXEC_TIMEOUT_MS, windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          resolve({ ok: false, output: stderr || stdout || error.message });
          return;
        }
        resolve({ ok: true, output: stdout || stderr });
      },
    );
  });
}

// Checks run in this order: whitelist, turned on, supported on this OS, dry run, then execute.
// When remote commands are off nothing below that check runs.
export async function runRemoteCommand(command, { enabled, dryRun }) {
  if (!REMOTE_COMMANDS.includes(command)) {
    return reply(false, 'Unknown command');
  }
  if (!enabled) {
    return reply(false, TURNED_OFF_MESSAGE);
  }

  const osCommand = getOsCommand(command);
  if (!osCommand) {
    return reply(false, getUnsupportedMessage());
  }
  if (dryRun) {
    return reply(true, `Dry run: would run ${formatCommandLine(osCommand)}`);
  }

  const result = await execOsCommand(osCommand);
  if (result.ok) {
    return reply(true, result.output.trim() || SUCCESS_MESSAGES[command]);
  }
  return reply(false, result.output);
}
