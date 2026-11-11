// Finds the default gateway (the home router) of this machine.
// Windows: `route print -4 0.0.0.0`. Linux: `ip route show default`, then /proc/net/route.
// The result is cached, because the gateway rarely changes and the monitor asks every minute.
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const CACHE_MS = 10 * 60 * 1000;
const COMMAND_TIMEOUT_MS = 5000;

let cached = null; // { ip, at }

// Picks the route with the lowest metric. routes: [{ gateway, metric }].
function bestGateway(routes) {
  const valid = routes.filter((route) => net.isIPv4(route.gateway) && route.gateway !== '0.0.0.0');
  valid.sort((a, b) => a.metric - b.metric);
  return valid[0]?.gateway ?? null;
}

// Active route rows look like: "0.0.0.0  0.0.0.0  192.168.1.1  192.168.1.20  50".
// Persistent route rows have no interface column, so they do not match.
export function parseWindowsRoutes(output) {
  const routes = [];
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^\s*0\.0\.0\.0\s+0\.0\.0\.0\s+(\S+)\s+(\S+)\s+(\d+)\s*$/);
    if (match) {
      routes.push({ gateway: match[1], metric: Number(match[3]) });
    }
  }
  return bestGateway(routes);
}

// Lines look like: "default via 192.168.1.1 dev wlan0 proto dhcp metric 600".
export function parseLinuxIpRoute(output) {
  const routes = [];
  for (const line of output.split(/\r?\n/)) {
    const via = line.match(/^default\s+via\s+(\S+)/);
    if (via) {
      const metric = line.match(/\bmetric\s+(\d+)/);
      routes.push({ gateway: via[1], metric: metric ? Number(metric[1]) : 0 });
    }
  }
  return bestGateway(routes);
}

// /proc/net/route stores addresses as little-endian hex. Destination 00000000 is the default route.
export function parseProcNetRoute(output) {
  const routes = [];
  for (const line of output.split(/\r?\n/).slice(1)) {
    const columns = line.trim().split(/\s+/);
    if (columns.length >= 7 && columns[1] === '00000000') {
      const bytes = columns[2].match(/../g) ?? [];
      const gateway = bytes.map((hex) => parseInt(hex, 16)).reverse().join('.');
      routes.push({ gateway, metric: Number(columns[6]) || 0 });
    }
  }
  return bestGateway(routes);
}

async function run(command, args) {
  const { stdout } = await execFileAsync(command, args, {
    timeout: COMMAND_TIMEOUT_MS,
    windowsHide: true,
  });
  return stdout;
}

async function detectGateway() {
  if (process.platform === 'win32') {
    return parseWindowsRoutes(await run('route', ['print', '-4', '0.0.0.0']));
  }
  try {
    const gateway = parseLinuxIpRoute(await run('ip', ['route', 'show', 'default']));
    if (gateway) {
      return gateway;
    }
  } catch {
    // `ip` may be missing (minimal images): fall back to the kernel table.
  }
  return parseProcNetRoute(await fs.readFile('/proc/net/route', 'utf8'));
}

// Resolves with the gateway IPv4 address, or null when there is none (or detection failed).
// Only a found gateway is cached, so a missing one is retried on the next call.
export async function getDefaultGateway() {
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return cached.ip;
  }
  try {
    const ip = await detectGateway();
    cached = ip ? { ip, at: Date.now() } : null;
    return ip;
  } catch (error) {
    console.error('[quality] gateway detection failed:', error.message);
    return null;
  }
}
