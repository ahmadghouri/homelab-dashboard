import { deviceKeys } from './queryKeys';

// About 5 minutes of points at one point every 5 seconds.
export const LIVE_POINTS_LIMIT = 60;

// Applies a change to a device in both the list and its detail cache.
function updateDevice(queryClient, deviceId, update) {
  queryClient.setQueryData(deviceKeys.list(), (devices) =>
    devices?.map((device) => (device.id === deviceId ? update(device) : device)),
  );
  queryClient.setQueryData(deviceKeys.detail(deviceId), (device) =>
    device ? update(device) : device,
  );
}

export function applyLiveMetrics(queryClient, { deviceId, metrics }) {
  updateDevice(queryClient, deviceId, (device) => ({ ...device, live: metrics, status: 'online' }));

  const point = {
    ts: metrics.at,
    cpu: metrics.cpu,
    memPct: metrics.mem.usedPct,
    netRxBps: metrics.net.rxBps,
    netTxBps: metrics.net.txBps,
  };
  queryClient.setQueryData(deviceKeys.live(deviceId), (points = []) =>
    [...points, point].slice(-LIVE_POINTS_LIMIT),
  );
}

export function applyDeviceStatus(queryClient, { deviceId, status, lastSeenAt }) {
  updateDevice(queryClient, deviceId, (device) => ({ ...device, status, lastSeenAt }));
}

// Hardware info from the agent hello. Keeps the cached live metrics.
export function applyDeviceInfo(queryClient, { device: changed }) {
  if (changed) {
    updateDevice(queryClient, changed.id, (device) => ({ ...device, ...changed }));
  }
}

export function removeDeviceFromCache(queryClient, deviceId) {
  queryClient.setQueryData(deviceKeys.list(), (devices) =>
    devices?.filter((device) => device.id !== deviceId),
  );
  queryClient.removeQueries({ queryKey: deviceKeys.detail(deviceId) });
  queryClient.removeQueries({ queryKey: deviceKeys.live(deviceId) });
}
