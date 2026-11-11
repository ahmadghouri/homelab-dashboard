import {
  createDevice,
  deleteDevice,
  getDevice,
  listDevices,
  regenerateAgentToken,
  renameDevice,
  toDeviceResponse,
} from '../services/deviceService.js';
import { getMetricHistory } from '../services/metricsService.js';
import { disconnectAgent, emitToDashboard } from '../sockets/registry.js';

export async function getDevices(req, res) {
  const devices = await listDevices();
  res.json({ devices: devices.map(toDeviceResponse) });
}

export async function getDeviceById(req, res) {
  const device = await getDevice(req.params.id);
  res.json({ device: toDeviceResponse(device) });
}

// The token is returned only here and on regenerate. It cannot be read again.
export async function postDevice(req, res) {
  const { device, token } = await createDevice(req.body);
  res.status(201).json({ device: toDeviceResponse(device), token });
}

export async function patchDevice(req, res) {
  const device = await renameDevice(req.params.id, req.body);
  res.json({ device: toDeviceResponse(device) });
}

export async function removeDevice(req, res) {
  // Disconnect first, so no more metrics arrive for a device that is being deleted.
  disconnectAgent(req.params.id);
  await deleteDevice(req.params.id);
  emitToDashboard('device:deleted', { deviceId: req.params.id });
  res.status(204).end();
}

// The old token stops working and the connected agent is disconnected.
export async function postDeviceToken(req, res) {
  const token = await regenerateAgentToken(req.params.id);
  disconnectAgent(req.params.id);
  res.json({ token });
}

export async function getDeviceMetrics(req, res) {
  await getDevice(req.params.id);
  res.json(await getMetricHistory(req.params.id, req.validatedQuery.range));
}
