// Shared access to Socket.io for code outside the socket handlers (controllers, jobs).

let dashboardNamespace = null;
const agentSockets = new Map();

export function setDashboardNamespace(namespace) {
  dashboardNamespace = namespace;
}

export function emitToDashboard(event, payload) {
  dashboardNamespace?.emit(event, payload);
}

// Keeps one live connection per device. Returns the previous socket, if any.
export function registerAgentSocket(deviceId, socket) {
  const previous = agentSockets.get(deviceId);
  agentSockets.set(deviceId, socket);
  return previous;
}

// Removes the socket only if it is still the current one for the device.
export function unregisterAgentSocket(deviceId, socket) {
  if (agentSockets.get(deviceId) !== socket) {
    return false;
  }
  agentSockets.delete(deviceId);
  return true;
}

export function disconnectAgent(deviceId) {
  agentSockets.get(deviceId)?.disconnect(true);
}
