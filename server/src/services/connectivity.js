import net from 'node:net';

const PROBE_TARGETS = [
  { host: '1.1.1.1', port: 443 },
  { host: '8.8.8.8', port: 443 },
  { host: '9.9.9.9', port: 443 },
];
const PROBE_TIMEOUT_MS = 3000;
// One lost check can be a blip, so "offline" needs this many failed checks in a row.
export const FAILED_CHECKS_FOR_OFFLINE = 2;

function canConnect({ host, port }) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const finish = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(PROBE_TIMEOUT_MS);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

// True when at least one public server accepts a TCP connection.
export async function probeInternet() {
  const results = await Promise.all(PROBE_TARGETS.map(canConnect));
  return results.some(Boolean);
}

// Turns raw check results into an online/offline state. No I/O, so it is easy to test.
// update() returns { changed, initial, online, since }:
// - initial: true for the first check (it decides the state without an outage)
// - since: when the current state started (for offline: the first failed check in the streak)
export function createConnectivityTracker({ failuresForOffline = FAILED_CHECKS_FOR_OFFLINE } = {}) {
  let online = null;
  let since = null;
  let failures = 0;
  let firstFailureAt = null;

  function setState(nextOnline, at) {
    online = nextOnline;
    since = at;
  }

  function update(reachable, checkedAt = new Date()) {
    if (online === null) {
      setState(reachable, checkedAt);
      failures = reachable ? 0 : 1;
      firstFailureAt = reachable ? null : checkedAt;
      return { changed: true, initial: true, online, since };
    }

    if (reachable) {
      failures = 0;
      firstFailureAt = null;
      if (online) {
        return { changed: false, initial: false, online, since };
      }
      setState(true, checkedAt);
      return { changed: true, initial: false, online, since };
    }

    failures += 1;
    firstFailureAt ??= checkedAt;
    if (online && failures >= failuresForOffline) {
      setState(false, firstFailureAt);
      return { changed: true, initial: false, online, since };
    }
    return { changed: false, initial: false, online, since };
  }

  return { update, getState: () => ({ online, since }) };
}
