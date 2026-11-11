import { apiClient } from '@/api/client';

// Returns { devices, scan }.
export function getNetworkDevices({ signal } = {}) {
  return apiClient.get('/network/devices', { signal });
}

export async function updateNetworkDevice({ id, ...changes }) {
  const data = await apiClient.patch(`/network/devices/${id}`, changes);
  return data.device;
}

export function forgetNetworkDevice(id) {
  return apiClient.delete(`/network/devices/${id}`);
}

// Waits for the scan to finish. Returns { found, new, scan }.
export function scanNetwork() {
  return apiClient.post('/network/scan');
}
