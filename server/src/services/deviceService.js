import crypto from 'node:crypto';
import { Device } from '../models/Device.js';
import { MetricSample } from '../models/MetricSample.js';
import { HttpError } from '../utils/httpError.js';
import { clearLiveMetrics, getLiveMetrics } from './liveMetricsStore.js';

const TOKEN_PREFIX = 'hl_';

// Agent tokens are 256-bit random values, so a fast SHA-256 hash is enough
// (unlike passwords, they cannot be guessed with a dictionary).
function hashAgentToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateAgentToken() {
  const token = TOKEN_PREFIX + crypto.randomBytes(32).toString('base64url');
  return { token, tokenHash: hashAgentToken(token) };
}

// API shape: stored device fields + latest live metrics (null when none yet).
export function toDeviceResponse(device) {
  return { ...device.toJSON(), live: getLiveMetrics(device.id) };
}

async function findDeviceOrThrow(id) {
  const device = await Device.findById(id);
  if (!device) {
    throw new HttpError(404, 'Device not found');
  }
  return device;
}

export function listDevices() {
  return Device.find().sort({ name: 1 });
}

export function getDevice(id) {
  return findDeviceOrThrow(id);
}

// Returns the plain token once. Only its hash is stored.
export async function createDevice({ name }) {
  const { token, tokenHash } = generateAgentToken();
  const device = await Device.create({ name, agentTokenHash: tokenHash });
  return { device, token };
}

export async function renameDevice(id, { name }) {
  const device = await findDeviceOrThrow(id);
  device.name = name;
  await device.save();
  return device;
}

export async function regenerateAgentToken(id) {
  const device = await findDeviceOrThrow(id);
  const { token, tokenHash } = generateAgentToken();
  device.agentTokenHash = tokenHash;
  await device.save();
  return token;
}

export async function deleteDevice(id) {
  const device = await findDeviceOrThrow(id);
  await Promise.all([device.deleteOne(), MetricSample.deleteMany({ deviceId: device._id })]);
  clearLiveMetrics(device.id);
}

export async function findDeviceByAgentToken(token) {
  if (typeof token !== 'string' || !token.startsWith(TOKEN_PREFIX)) {
    return null;
  }
  return Device.findOne({ agentTokenHash: hashAgentToken(token) });
}

export function setDeviceStatus(id, status) {
  return Device.findByIdAndUpdate(id, { status, lastSeenAt: new Date() }, { returnDocument: 'after' });
}

export function updateDeviceInfo(id, info) {
  return Device.findByIdAndUpdate(id, info, { returnDocument: 'after' });
}

// Agents cannot be connected right after a server start.
export function markAllDevicesOffline() {
  return Device.updateMany({ status: 'online' }, { status: 'offline' });
}
