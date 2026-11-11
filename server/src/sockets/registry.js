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

// Keeps the name used in alert messages current after a rename.
export function updateAgentDeviceName(deviceId, name) {
  const socket = agentSockets.get(deviceId);
  if (socket) {
    socket.data.deviceName = name;
  }
}

export function disconnectAgent(deviceId) {
  agentSockets.get(deviceId)?.disconnect(true);
}

// The live socket of a device's agent, or undefined when it is not connected.
export function getAgentSocket(deviceId) {
  const socket = agentSockets.get(deviceId);
  return socket?.connected ? socket : undefined;
}

export function isAgentConnected(deviceId) {
  return agentSockets.get(deviceId)?.connected === true;
}

export class AgentOfflineError extends Error {
  constructor() {
    super('Agent is not connected');
    this.name = 'AgentOfflineError';
  }
}

// Sends a command and waits for the agent's acknowledgement.
// Throws AgentOfflineError without a connection, and Socket.io's timeout error when the agent does not answer.
export function sendAgentCommand(deviceId, payload, timeoutMs) {
  const socket = agentSockets.get(deviceId);
  if (!socket?.connected) {
    throw new AgentOfflineError();
  }
  return socket.timeout(timeoutMs).emitWithAck('agent:command', payload);
}
