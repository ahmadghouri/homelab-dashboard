// Pure parsers for RouterOS REST values. RouterOS returns every value as a string.

const UPTIME_UNITS = { w: 604800, d: 86400, h: 3600, m: 60, s: 1 };

export function toBool(value) {
  return value === true || value === 'true' || value === 'yes';
}

export function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

// "1w2d3h4m5s", "2d03:04:05" or "03:04:05" → seconds.
export function parseUptime(value) {
  if (typeof value !== 'string' || !value) {
    return null;
  }
  let seconds = 0;
  let rest = value.trim();
  const clock = rest.match(/(\d+):(\d{2}):(\d{2})$/);
  if (clock) {
    seconds += Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3]);
    rest = rest.slice(0, clock.index);
  }
  for (const [, amount, unit] of rest.matchAll(/(\d+)([wdhms])/g)) {
    seconds += Number(amount) * UPTIME_UNITS[unit];
  }
  return seconds;
}

// Simple queue "upload/download" pair → [up, down]. Up = sent by the target, down = received.
export function parsePair(value) {
  if (typeof value !== 'string' || !value.includes('/')) {
    return [null, null];
  }
  const [up, down] = value.split('/');
  return [toNumber(up), toNumber(down)];
}

export function queueStats(queue) {
  if (!queue) {
    return { rxBytes: null, txBytes: null, rxBps: null, txBps: null };
  }
  const [txBytes, rxBytes] = parsePair(queue.bytes);
  const [txBps, rxBps] = parsePair(queue.rate);
  return { rxBytes, txBytes, rxBps, txBps };
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

// Interface used by a default route: "1.2.3.4%ether1" → ether1, "pppoe-out1" → pppoe-out1.
function routeInterface(route) {
  for (const field of [route['immediate-gw'], route.gateway]) {
    if (typeof field !== 'string' || !field) {
      continue;
    }
    if (field.includes('%')) {
      return field.split('%').pop();
    }
    if (!IPV4.test(field)) {
      return field;
    }
  }
  return typeof route.gateway === 'string' && route.gateway ? route.gateway : null;
}

// WAN lines = interfaces of the default routes. A line is active when its route is the active one.
export function buildWans(routes, interfaces) {
  const running = new Map((interfaces ?? []).map((item) => [item.name, toBool(item.running)]));
  const wans = new Map();
  for (const route of routes ?? []) {
    if (route['dst-address'] && route['dst-address'] !== '0.0.0.0/0') {
      continue;
    }
    const name = routeInterface(route);
    if (!name) {
      continue;
    }
    const wan = wans.get(name) ?? {
      name,
      running: running.get(name) ?? false,
      active: false,
      gateway: route.gateway ?? null,
      distance: toNumber(route.distance),
    };
    if (toBool(route.active)) {
      wan.active = true;
      wan.gateway = route.gateway ?? wan.gateway;
      wan.distance = toNumber(route.distance);
    }
    wans.set(name, wan);
  }
  return [...wans.values()].sort((a, b) => (a.distance ?? 255) - (b.distance ?? 255));
}
