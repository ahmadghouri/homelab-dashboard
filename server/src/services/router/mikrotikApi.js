import { idPath } from './mikrotikClient.js';
import { buildWans, parseUptime, toNumber } from './mikrotikParse.js';

// Router operations on top of a client from createMikrotikClient(). No database access here.

export const QUEUE_PREFIX = 'homelab-';
export const BLOCK_LIST = 'homelab-blocked';
export const BLOCK_RULE_COMMENT = 'homelab-dashboard block';
export const PRIORITY_LEVELS = { high: 1, normal: 4, low: 8 };

export function queueName(mac) {
  return `${QUEUE_PREFIX}${mac.replace(/[^0-9a-f]/gi, '').toLowerCase()}`;
}

export async function getRouterInfo(client) {
  const [resource, identity, interfaces, routes] = await Promise.all([
    client.get('/system/resource'),
    client.get('/system/identity'),
    client.get('/interface'),
    client.get('/ip/route', { 'dst-address': '0.0.0.0/0' }),
  ]);
  return {
    identity: identity?.name ?? null,
    version: resource?.version ?? null,
    uptimeSec: parseUptime(resource?.uptime),
    cpuLoad: toNumber(resource?.['cpu-load']),
    wans: buildWans(routes, interfaces),
  };
}

// All dashboard queues, keyed by name.
export async function listHomelabQueues(client) {
  const queues = (await client.get('/queue/simple')) ?? [];
  return new Map(
    queues.filter((queue) => queue.name?.startsWith(QUEUE_PREFIX)).map((queue) => [queue.name, queue]),
  );
}

async function findQueue(client, name) {
  const found = (await client.get('/queue/simple', { name })) ?? [];
  return found.find((queue) => queue.name === name) ?? null;
}

function queueFields({ ip, priority, maxMbps }) {
  const level = PRIORITY_LEVELS[priority] ?? PRIORITY_LEVELS.normal;
  const limit = maxMbps ? `${maxMbps}M/${maxMbps}M` : '0/0';
  return { target: `${ip}/32`, 'max-limit': limit, priority: `${level}/${level}` };
}

// Creates or updates the device queue. Returns the queue as the router reports it.
export async function upsertQueue(client, { mac, ip, priority, maxMbps }) {
  const name = queueName(mac);
  const fields = queueFields({ ip, priority, maxMbps });
  const existing = await findQueue(client, name);
  if (!existing) {
    return client.put('/queue/simple', { name, ...fields, comment: 'homelab-dashboard' });
  }
  return client.patch(idPath('/queue/simple', existing['.id']), fields);
}

export async function removeQueue(client, mac) {
  const existing = await findQueue(client, queueName(mac));
  if (existing) {
    await client.del(idPath('/queue/simple', existing['.id']));
  }
}

async function ensureBlockRule(client) {
  const rules = (await client.get('/ip/firewall/filter')) ?? [];
  const exists = rules.some(
    (rule) => rule.comment === BLOCK_RULE_COMMENT && rule['src-address-list'] === BLOCK_LIST,
  );
  if (exists) {
    return;
  }
  // Placed first so earlier accept rules do not let the device through.
  const first = rules[0]?.['.id'];
  await client.put('/ip/firewall/filter', {
    chain: 'forward',
    'src-address-list': BLOCK_LIST,
    action: 'drop',
    comment: BLOCK_RULE_COMMENT,
    ...(first ? { 'place-before': first } : {}),
  });
}

async function blockEntries(client) {
  return (await client.get('/ip/firewall/address-list', { list: BLOCK_LIST })) ?? [];
}

export async function blockAddress(client, { ip, mac }) {
  await ensureBlockRule(client);
  const entries = await blockEntries(client);
  if (!entries.some((entry) => entry.address === ip)) {
    await client.put('/ip/firewall/address-list', { list: BLOCK_LIST, address: ip, comment: mac });
  }
}

// Removes the entry by IP and by MAC comment, in case the device changed its IP since.
export async function unblockAddress(client, { ip, mac }) {
  const entries = await blockEntries(client);
  const matches = entries.filter((entry) => (ip && entry.address === ip) || entry.comment === mac);
  for (const entry of matches) {
    await client.del(idPath('/ip/firewall/address-list', entry['.id']));
  }
}
