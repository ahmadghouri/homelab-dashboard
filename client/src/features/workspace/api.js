import { apiClient } from '@/api/client';

// Returns { workspace: snapshot | null, online: boolean }.
export function getWorkspace(deviceId, { signal } = {}) {
  return apiClient.get(`/devices/${deviceId}/workspace`, { signal });
}

// Returns the action log. Its `status` (success, failed, timeout) is the result;
// failed and timeout are not HTTP errors.
export async function runWorkspaceAction({ deviceId, target, id, action }) {
  const data = await apiClient.post(`/devices/${deviceId}/workspace/actions`, { target, id, action });
  return data.action;
}

export async function getWorkspaceActions(deviceId, { limit = 50, signal } = {}) {
  const data = await apiClient.get(`/devices/${deviceId}/workspace/actions?limit=${limit}`, { signal });
  return data.actions;
}

// Returns { ok, output, lines }. `ok: false` (for example control turned off) is not an HTTP error.
export function getWorkspaceLogs({ deviceId, target, id, lines = 300 }, { signal } = {}) {
  const params = new URLSearchParams({ target, id, lines: String(lines) });
  return apiClient.get(`/devices/${deviceId}/workspace/logs?${params}`, { signal });
}
