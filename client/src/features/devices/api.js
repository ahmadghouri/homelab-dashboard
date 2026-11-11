import { apiClient } from '@/api/client';

export async function getDevices({ signal } = {}) {
  const data = await apiClient.get('/devices', { signal });
  return data.devices;
}

export async function getDevice(id, { signal } = {}) {
  const data = await apiClient.get(`/devices/${id}`, { signal });
  return data.device;
}

export function getDeviceHistory(id, range, { signal } = {}) {
  return apiClient.get(`/devices/${id}/metrics?range=${encodeURIComponent(range)}`, { signal });
}

// Returns { device, token }. The token is shown once.
export function createDevice({ name }) {
  return apiClient.post('/devices', { name });
}

export async function renameDevice({ id, name }) {
  const data = await apiClient.patch(`/devices/${id}`, { name });
  return data.device;
}

export function deleteDevice(id) {
  return apiClient.delete(`/devices/${id}`);
}

export async function regenerateDeviceToken(id) {
  const data = await apiClient.post(`/devices/${id}/token`);
  return data.token;
}
