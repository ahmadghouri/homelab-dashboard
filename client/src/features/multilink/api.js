import { apiClient } from '@/api/client';

// Interface names contain spaces (for example "Ethernet 2"), so the line id is URL-encoded.
function linePath(deviceId, lineId) {
  return `/devices/${deviceId}/multilink/lines/${encodeURIComponent(lineId)}`;
}

// Returns { multilink: snapshot | null, settings: { mode, sticky, lines }, online: boolean }.
export function getMultiLink(deviceId, { signal } = {}) {
  return apiClient.get(`/devices/${deviceId}/multilink`, { signal });
}

// settings: { mode, sticky, lines: { [lineId]: { role, capGb: number | null } } }.
// Returns { settings, pushed: { ok, output } | null }.
export function saveMultiLinkSettings({ deviceId, settings }) {
  return apiClient.put(`/devices/${deviceId}/multilink/settings`, settings);
}

// Returns { ok, output, downloadMbps }. `ok: false` (for example Multi-Link turned off) is not an HTTP error.
export function runLineSpeedTest({ deviceId, lineId }) {
  return apiClient.post(`${linePath(deviceId, lineId)}/speedtest`);
}

// Returns { ok, output }.
export function resetLineUsage({ deviceId, lineId }) {
  return apiClient.post(`${linePath(deviceId, lineId)}/reset`);
}
