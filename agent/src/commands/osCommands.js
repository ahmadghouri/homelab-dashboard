// Fixed OS command lines for each remote command. Nothing here comes from the server:
// the server only picks a name from this whitelist.

export const REMOTE_COMMANDS = ['lock', 'restart', 'shutdown', 'cancel_shutdown'];

const WINDOWS_COMMANDS = {
  lock: { file: 'rundll32.exe', args: ['user32.dll,LockWorkStation'] },
  restart: {
    file: 'shutdown',
    args: ['/r', '/t', '60', '/c', 'Restart requested from Homelab Dashboard'],
  },
  shutdown: {
    file: 'shutdown',
    args: ['/s', '/t', '60', '/c', 'Shutdown requested from Homelab Dashboard'],
  },
  cancel_shutdown: { file: 'shutdown', args: ['/a'] },
};

const LINUX_COMMANDS = {
  lock: { file: 'loginctl', args: ['lock-sessions'] },
  restart: { file: 'shutdown', args: ['-r', '+1'] },
  shutdown: { file: 'shutdown', args: ['-h', '+1'] },
  cancel_shutdown: { file: 'shutdown', args: ['-c'] },
};

const MAC_COMMANDS = {
  lock: { file: 'pmset', args: ['displaysleepnow'] },
};

const COMMANDS_BY_PLATFORM = {
  win32: WINDOWS_COMMANDS,
  linux: LINUX_COMMANDS,
  darwin: MAC_COMMANDS,
};

// Shown when the OS command succeeds without printing anything.
export const SUCCESS_MESSAGES = {
  lock: 'PC locked',
  restart: 'Restart in 60 seconds',
  shutdown: 'Shutdown in 60 seconds',
  cancel_shutdown: 'Shutdown cancelled',
};

// Returns { file, args } or null when the command is not supported on this OS.
export function getOsCommand(command, platform = process.platform) {
  return COMMANDS_BY_PLATFORM[platform]?.[command] ?? null;
}

export function getUnsupportedMessage(platform = process.platform) {
  return platform === 'darwin' ? 'Not supported on macOS' : `Not supported on ${platform}`;
}

// Readable command line for logs and dry run replies.
export function formatCommandLine({ file, args }) {
  return [file, ...args].map((part) => (part.includes(' ') ? `"${part}"` : part)).join(' ');
}
