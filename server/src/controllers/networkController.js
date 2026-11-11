import { onNetworkDeviceTrusted } from '../services/alertEngine.js';
import {
  forgetNetworkDevice,
  getScanStatus,
  listNetworkDevices,
  scanNetwork,
  updateNetworkDevice,
} from '../services/networkService.js';

export async function getNetworkDevices(req, res) {
  const devices = await listNetworkDevices();
  res.json({ devices, scan: getScanStatus() });
}

export async function patchNetworkDevice(req, res) {
  const device = await updateNetworkDevice(req.params.id, req.body);
  if (device.trusted) {
    await onNetworkDeviceTrusted(device.id);
  }
  res.json({ device });
}

export async function deleteNetworkDevice(req, res) {
  await forgetNetworkDevice(req.params.id);
  await onNetworkDeviceTrusted(req.params.id, 'Device forgotten');
  res.status(204).end();
}

export async function postScan(req, res) {
  const result = await scanNetwork();
  res.json({ ...result, scan: getScanStatus() });
}
