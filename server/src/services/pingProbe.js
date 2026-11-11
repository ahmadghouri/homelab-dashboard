// Measures packet loss, latency and jitter to one host with the system `ping` command
// (no admin rights needed, unlike raw ICMP sockets).
// Parsing reads the per-reply lines only, so it works across OS languages:
// a reply line has a TTL and a time like "time=16ms", "Zeit=16ms", "time<1ms" or "time=16.2 ms".
import { execFile } from 'node:child_process';
import net from 'node:net';

export const PING_COUNT = 10;
const REPLY_TIMEOUT_MS = 1000;
const COMMAND_TIMEOUT_MS = 20 * 1000;

// No space between "=" and the number: the Windows summary line ("Minimum = 16ms") must not match.
const TIME_PATTERN = /([=<])(\d+(?:[.,]\d+)?)\s?ms\b/i;
const TTL_PATTERN = /\bttl[=:]/i;

const round1 = (value) => Math.round(value * 10) / 10;

// Reply times in ms, in order. "time<1ms" counts as 0.5 ms (the middle of the range).
export function parseReplyTimes(output) {
  const times = [];
  for (const line of output.split(/\r?\n/)) {
    if (!TTL_PATTERN.test(line)) {
      continue;
    }
    const match = line.match(TIME_PATTERN);
    if (match) {
      const value = Number(match[2].replace(',', '.'));
      times.push(match[1] === '<' ? value / 2 : value);
    }
  }
  return times;
}

// Jitter: average difference between consecutive replies (like RFC 3550, without smoothing).
function jitterOf(times) {
  if (times.length < 2) {
    return null;
  }
  let total = 0;
  for (let i = 1; i < times.length; i += 1) {
    total += Math.abs(times[i] - times[i - 1]);
  }
  return round1(total / (times.length - 1));
}

// Turns ping output into numbers. Missing replies count as lost.
export function parsePingOutput(output, sent = PING_COUNT) {
  const times = parseReplyTimes(output).slice(0, sent); // Linux can print duplicate replies
  const received = times.length;
  const stats = {
    sent,
    received,
    lossPct: round1(((sent - received) / sent) * 100),
    avgMs: null,
    minMs: null,
    maxMs: null,
    jitterMs: jitterOf(times),
  };
  if (received > 0) {
    stats.avgMs = round1(times.reduce((sum, time) => sum + time, 0) / received);
    stats.minMs = round1(Math.min(...times));
    stats.maxMs = round1(Math.max(...times));
  }
  return stats;
}

function pingArgs(host) {
  if (process.platform === 'win32') {
    return ['-n', String(PING_COUNT), '-w', String(REPLY_TIMEOUT_MS), host];
  }
  return ['-c', String(PING_COUNT), '-W', String(REPLY_TIMEOUT_MS / 1000), host];
}

// Sends PING_COUNT pings to an IPv4 address. Resolves with the parsed stats.
// ping exits with an error code when replies are lost; that is a result, not a failure.
// Rejects only when ping could not run at all (for example, the command is missing).
export function pingHost(host) {
  if (!net.isIPv4(host)) {
    return Promise.reject(new Error('Ping target must be an IPv4 address'));
  }
  return new Promise((resolve, reject) => {
    execFile(
      'ping',
      pingArgs(host),
      { timeout: COMMAND_TIMEOUT_MS, windowsHide: true },
      (error, stdout) => {
        if (error && typeof error.code === 'string') {
          reject(new Error(`ping could not run: ${error.code}`));
          return;
        }
        resolve(parsePingOutput(String(stdout ?? '')));
      },
    );
  });
}
