import { NetworkDevice } from '../models/NetworkDevice.js';
import { emitToDashboard } from '../sockets/registry.js';
import { HttpError } from '../utils/httpError.js';
import { discoverDevices, getLocalNetwork } from './networkDiscovery.js';

const scanState = {
  scanning: false,
  lastScanAt: null,
  lastDurationMs: null,
  lastError: null,
  found: 0,
};

// Other modules (the alert engine) can react to new or changed devices.
const newDeviceListeners = new Set();

export function onNewNetworkDevices(listener) {
  newDeviceListeners.add(listener);
}

export function getScanStatus() {
  const net = getLocalNetwork();
  return { ...scanState, subnet: net?.cidr ?? null, interfaceName: net?.interfaceName ?? null };
}

export function listNetworkDevices() {
  return NetworkDevice.find().sort({ online: -1, ip: 1 });
}

async function saveScanResult(devices, seenAt) {
  const isFirstScan = (await NetworkDevice.estimatedDocumentCount()) === 0;
  const existing = new Set((await NetworkDevice.find({}, { mac: 1 })).map((d) => d.mac));
  const created = [];

  for (const found of devices) {
    const update = {
      ip: found.ip,
      randomizedMac: found.randomizedMac,
      online: true,
      lastSeenAt: seenAt,
      ...(found.vendor ? { vendor: found.vendor } : {}),
      ...(found.hostname ? { hostname: found.hostname } : {}),
      ...(found.isScanner ? { isScanner: true, trusted: true } : {}),
    };
    const device = await NetworkDevice.findOneAndUpdate(
      { mac: found.mac },
      { $set: update, $setOnInsert: { mac: found.mac, firstSeenAt: seenAt } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    if (!existing.has(found.mac)) {
      created.push(device);
    }
  }

  await NetworkDevice.updateMany(
    { mac: { $nin: devices.map((d) => d.mac) }, online: true },
    { online: false },
  );

  return { created, isFirstScan };
}

// Runs one scan. Concurrent calls share the running scan instead of starting another.
let runningScan = null;

export function scanNetwork() {
  runningScan ??= (async () => {
    const startedAt = Date.now();
    scanState.scanning = true;
    emitToDashboard('network:scan', { scanning: true });
    try {
      const { devices } = await discoverDevices();
      const { created, isFirstScan } = await saveScanResult(devices, new Date());

      Object.assign(scanState, { found: devices.length, lastError: null });
      // The first scan only builds the list. Alerting on every device at once is noise.
      const unknown = created.filter((device) => !device.trusted);
      if (!isFirstScan && unknown.length > 0) {
        for (const listener of newDeviceListeners) {
          listener(unknown);
        }
      }
      return { found: devices.length, new: created.length };
    } catch (error) {
      scanState.lastError = error.message;
      throw error;
    } finally {
      Object.assign(scanState, {
        scanning: false,
        lastScanAt: new Date(),
        lastDurationMs: Date.now() - startedAt,
      });
      emitToDashboard('network:update', getScanStatus());
      runningScan = null;
    }
  })();
  return runningScan;
}

async function findOrThrow(id) {
  const device = await NetworkDevice.findById(id);
  if (!device) {
    throw new HttpError(404, 'Network device not found');
  }
  return device;
}

// changes: { customName?, trusted? }
export async function updateNetworkDevice(id, changes) {
  const device = await findOrThrow(id);
  if (changes.customName !== undefined) {
    device.customName = changes.customName || undefined;
  }
  if (changes.trusted !== undefined) {
    device.trusted = changes.trusted;
  }
  await device.save();
  emitToDashboard('network:update', getScanStatus());
  return device;
}

// Removes a device from the list. If it is still on the network, the next scan finds it as new.
export async function forgetNetworkDevice(id) {
  const device = await findOrThrow(id);
  await device.deleteOne();
  emitToDashboard('network:update', getScanStatus());
  return device;
}
