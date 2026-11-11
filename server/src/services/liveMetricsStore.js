// In-memory store for live agent metrics.
// - latest: last payload per device, sent to the dashboard on page load.
// - buffer: payloads since the last flush, averaged into one saved sample per minute.

const devices = new Map();

export function recordLiveMetrics(deviceId, metrics) {
  const at = new Date().toISOString();
  const entry = devices.get(deviceId) ?? { buffer: [] };
  entry.latest = { ...metrics, at };
  entry.buffer.push(metrics);
  devices.set(deviceId, entry);
  return entry.latest;
}

export function getLiveMetrics(deviceId) {
  return devices.get(deviceId)?.latest ?? null;
}

export function clearLiveMetrics(deviceId) {
  devices.delete(deviceId);
}

// Returns [deviceId, buffer] pairs with data and empties the buffers.
export function drainBuffers() {
  const drained = [];
  for (const [deviceId, entry] of devices) {
    if (entry.buffer.length > 0) {
      drained.push([deviceId, entry.buffer]);
      entry.buffer = [];
    }
  }
  return drained;
}
