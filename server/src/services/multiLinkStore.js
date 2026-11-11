// In-memory store for the latest multi-link snapshot of each PC.
// Snapshots arrive every 5 s, so nothing is saved to the database.

const snapshots = new Map();

// device: { id, name }. Returns the previous snapshot (or null) so callers can detect changes.
export function setMultiLink(device, multilink) {
  const previous = snapshots.get(device.id)?.multilink ?? null;
  snapshots.set(device.id, { device, multilink });
  return previous;
}

export function getMultiLink(deviceId) {
  return snapshots.get(deviceId)?.multilink ?? null;
}

// Returns the removed entry ({ device, multilink }) or null.
export function deleteMultiLink(deviceId) {
  const entry = snapshots.get(deviceId) ?? null;
  snapshots.delete(deviceId);
  return entry;
}
