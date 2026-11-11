// In-memory store for the latest dev workspace snapshot of each PC.
// Snapshots arrive every 10 s, so nothing is saved to the database.

const workspaces = new Map();

// device: { id, name }. Returns the previous snapshot (or null) so callers can detect changes.
export function setWorkspace(device, workspace) {
  const previous = workspaces.get(device.id)?.workspace ?? null;
  workspaces.set(device.id, { device, workspace });
  return previous;
}

export function getWorkspace(deviceId) {
  return workspaces.get(deviceId)?.workspace ?? null;
}

// Returns the removed entry ({ device, workspace }) or null.
export function deleteWorkspace(deviceId) {
  const entry = workspaces.get(deviceId) ?? null;
  workspaces.delete(deviceId);
  return entry;
}
