import {
  blockDevice,
  getRouterStatus,
  listRouterDevices,
  setDevicePriority,
  trackDevice,
  unblockDevice,
  untrackDevice,
} from '../services/router/routerService.js';

export async function getStatus(req, res) {
  res.json(await getRouterStatus());
}

export async function getDevices(req, res) {
  res.json({ devices: await listRouterDevices() });
}

export async function postTrack(req, res) {
  res.json({ device: await trackDevice(req.params.id) });
}

export async function deleteTrack(req, res) {
  res.json({ device: await untrackDevice(req.params.id) });
}

export async function putPriority(req, res) {
  res.json({ device: await setDevicePriority(req.params.id, req.body) });
}

export async function postBlock(req, res) {
  res.json({ device: await blockDevice(req.params.id) });
}

export async function deleteBlock(req, res) {
  res.json({ device: await unblockDevice(req.params.id) });
}
