import { apiClient } from '@/api/client';

// Router (MikroTik) ------------------------------------------------------------

// Returns { configured, type, reachable, error, identity, version, uptimeSec, cpuLoad, wans }.
// Not configured: { configured: false, type: 'none' }.
export function getRouterStatus({ signal } = {}) {
  return apiClient.get('/router/status', { signal });
}

// Returns [{ networkDeviceId, name, ip, mac, online, isScanner, tracked, priority, maxMbps, blocked,
// rxBytes, txBytes, rxBps, txBps }]. Rates are BITS per second, totals are bytes.
// Every write below returns { device: <updated row> }.
export async function getRouterDevices({ signal } = {}) {
  const data = await apiClient.get('/router/devices', { signal });
  return data.devices;
}

export function trackRouterDevice(id) {
  return apiClient.post(`/router/devices/${id}/track`);
}

export function untrackRouterDevice(id) {
  return apiClient.delete(`/router/devices/${id}/track`);
}

// priority: 'high' | 'normal' | 'low'; maxMbps: 1..10000 or null for no limit.
export function setRouterDevicePriority({ id, priority, maxMbps }) {
  return apiClient.put(`/router/devices/${id}/priority`, { priority, maxMbps });
}

export function blockRouterDevice(id) {
  return apiClient.post(`/router/devices/${id}/block`);
}

export function unblockRouterDevice(id) {
  return apiClient.delete(`/router/devices/${id}/block`);
}

// DNS (AdGuard Home) -----------------------------------------------------------

// Returns { configured, reachable, error, protectionEnabled, version, queries, blocked, blockedPct,
// avgProcessingMs, topBlocked, topClients }. Not configured: { configured: false }.
export function getDnsStatus({ signal } = {}) {
  return apiClient.get('/dns/status', { signal });
}

// Returns the new DNS status.
export function setDnsProtection(enabled) {
  return apiClient.post('/dns/protection', { enabled });
}
