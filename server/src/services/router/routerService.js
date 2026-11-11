import { NetworkDevice } from '../../models/NetworkDevice.js';
import { RouterDeviceSetting } from '../../models/RouterDeviceSetting.js';
import { HttpError } from '../../utils/httpError.js';
import { getRouterConfig } from './config.js';
import {
  blockAddress,
  getRouterInfo,
  listHomelabQueues,
  queueName,
  removeQueue,
  unblockAddress,
  upsertQueue,
} from './mikrotikApi.js';
import { createMikrotikClient } from './mikrotikClient.js';
import { queueStats } from './mikrotikParse.js';

// Every function takes the router config as an optional last argument so tests can point it at a mock.

const clients = new WeakMap();

function clientFor(config) {
  if (!clients.has(config)) {
    clients.set(config, createMikrotikClient(config));
  }
  return clients.get(config);
}

function requireConfigured(config) {
  if (!config.configured) {
    throw new HttpError(409, 'Router is not configured');
  }
  return clientFor(config);
}

// Router writes run one at a time so two clicks cannot create the block rule twice.
let writeQueue = Promise.resolve();

function serialized(task) {
  const run = writeQueue.then(task, task);
  writeQueue = run.catch(() => {});
  return run;
}

export async function getRouterStatus(config = getRouterConfig()) {
  if (!config.configured) {
    return { configured: false, type: config.type, ...(config.error ? { error: config.error } : {}) };
  }
  const base = { configured: true, type: config.type };
  try {
    const info = await getRouterInfo(clientFor(config));
    return { ...base, reachable: true, error: null, ...info };
  } catch (error) {
    if (!error.status) {
      throw error;
    }
    return {
      ...base,
      reachable: false,
      error: error.message,
      identity: null,
      version: null,
      uptimeSec: null,
      cpuLoad: null,
      wans: [],
    };
  }
}

function toRow(device, setting, queue) {
  return {
    networkDeviceId: device._id.toString(),
    name: device.customName || device.hostname || device.vendor || device.ip || device.mac,
    ip: device.ip ?? null,
    mac: device.mac,
    online: device.online,
    isScanner: device.isScanner,
    tracked: setting?.tracked ?? false,
    priority: setting?.priority ?? 'normal',
    maxMbps: setting?.maxMbps ?? null,
    blocked: setting?.blocked ?? false,
    ...queueStats(queue),
  };
}

export async function listRouterDevices(config = getRouterConfig()) {
  const client = requireConfigured(config);
  const [devices, settings, queues] = await Promise.all([
    NetworkDevice.find({}, { mac: 1, ip: 1, customName: 1, hostname: 1, vendor: 1, online: 1, isScanner: 1 })
      .sort({ online: -1, ip: 1 })
      .lean(),
    RouterDeviceSetting.find().lean(),
    listHomelabQueues(client),
  ]);
  const byDevice = new Map(settings.map((setting) => [setting.networkDeviceId.toString(), setting]));
  return devices.map((device) =>
    toRow(device, byDevice.get(device._id.toString()), queues.get(queueName(device.mac))),
  );
}

async function loadDevice(id) {
  const device = await NetworkDevice.findById(id).lean();
  if (!device) {
    throw new HttpError(404, 'Network device not found');
  }
  if (!device.ip) {
    throw new HttpError(409, 'This device has no IP address yet');
  }
  return device;
}

async function loadSetting(device) {
  return RouterDeviceSetting.findOne({ networkDeviceId: device._id }).lean();
}

async function saveSetting(device, update) {
  await RouterDeviceSetting.findOneAndUpdate(
    { networkDeviceId: device._id },
    { $set: { ...update, mac: device.mac }, $setOnInsert: { networkDeviceId: device._id } },
    { upsert: true, setDefaultsOnInsert: true },
  );
}

async function rowFor(device, client) {
  const [setting, queues] = await Promise.all([loadSetting(device), listHomelabQueues(client)]);
  return toRow(device, setting, queues.get(queueName(device.mac)));
}

export function trackDevice(id, config = getRouterConfig()) {
  const client = requireConfigured(config);
  return serialized(async () => {
    const device = await loadDevice(id);
    const setting = await loadSetting(device);
    await upsertQueue(client, {
      mac: device.mac,
      ip: device.ip,
      priority: setting?.priority ?? 'normal',
      maxMbps: setting?.maxMbps ?? null,
    });
    await saveSetting(device, { tracked: true });
    return rowFor(device, client);
  });
}

// Removing the queue also drops its priority and limit, so those reset to the defaults.
export function untrackDevice(id, config = getRouterConfig()) {
  const client = requireConfigured(config);
  return serialized(async () => {
    const device = await loadDevice(id);
    await removeQueue(client, device.mac);
    await saveSetting(device, { tracked: false, priority: 'normal', maxMbps: null });
    return rowFor(device, client);
  });
}

export function setDevicePriority(id, { priority, maxMbps = null }, config = getRouterConfig()) {
  const client = requireConfigured(config);
  return serialized(async () => {
    const device = await loadDevice(id);
    await upsertQueue(client, { mac: device.mac, ip: device.ip, priority, maxMbps });
    await saveSetting(device, { tracked: true, priority, maxMbps });
    return rowFor(device, client);
  });
}

export function blockDevice(id, config = getRouterConfig()) {
  const client = requireConfigured(config);
  return serialized(async () => {
    const device = await loadDevice(id);
    if (device.isScanner) {
      throw new HttpError(409, 'The dashboard server cannot be blocked');
    }
    if (device.ip === config.host) {
      throw new HttpError(409, 'The router itself cannot be blocked');
    }
    await blockAddress(client, { ip: device.ip, mac: device.mac });
    await saveSetting(device, { blocked: true });
    return rowFor(device, client);
  });
}

export function unblockDevice(id, config = getRouterConfig()) {
  const client = requireConfigured(config);
  return serialized(async () => {
    const device = await NetworkDevice.findById(id).lean();
    if (!device) {
      throw new HttpError(404, 'Network device not found');
    }
    await unblockAddress(client, { ip: device.ip, mac: device.mac });
    await saveSetting(device, { blocked: false });
    return rowFor(device, client);
  });
}
