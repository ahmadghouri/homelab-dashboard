import {
  findDeviceByAgentToken,
  setDeviceStatus,
  updateDeviceInfo,
} from '../services/deviceService.js';
import { recordLiveMetrics } from '../services/liveMetricsStore.js';
import { agentHelloSchema, agentMetricsSchema } from '../validators/deviceValidators.js';
import { emitToDashboard, registerAgentSocket, unregisterAgentSocket } from './registry.js';

async function authenticateAgent(socket, next) {
  try {
    const device = await findDeviceByAgentToken(socket.handshake.auth?.token);
    if (!device) {
      next(new Error('Invalid agent token'));
      return;
    }
    socket.data.deviceId = device.id;
    next();
  } catch (error) {
    console.error('[agent] auth failed:', error.message);
    next(new Error('Server error'));
  }
}

async function updateStatus(deviceId, status) {
  const device = await setDeviceStatus(deviceId, status);
  if (device) {
    emitToDashboard('device:status', { deviceId, status, lastSeenAt: device.lastSeenAt });
  }
}

// Socket.io does not catch errors in async handlers, so each handler logs its own.
function safeHandler(label, handler) {
  return async (payload) => {
    try {
      await handler(payload);
    } catch (error) {
      console.error(`[agent] ${label} failed:`, error.message);
    }
  };
}

function handleConnection(socket) {
  const { deviceId } = socket.data;

  // A second connection with the same token replaces the first one.
  const previous = registerAgentSocket(deviceId, socket);
  if (previous && previous !== socket) {
    previous.disconnect(true);
  }

  safeHandler('status', () => updateStatus(deviceId, 'online'))();

  socket.on(
    'agent:hello',
    safeHandler('hello', async (payload) => {
      const result = agentHelloSchema.safeParse(payload);
      if (!result.success) {
        console.warn(`[agent] invalid hello from ${deviceId}`);
        return;
      }
      const device = await updateDeviceInfo(deviceId, result.data);
      emitToDashboard('device:updated', { device: device?.toJSON() });
    }),
  );

  socket.on(
    'agent:metrics',
    safeHandler('metrics', (payload) => {
      const result = agentMetricsSchema.safeParse(payload);
      if (!result.success) {
        console.warn(`[agent] invalid metrics from ${deviceId}`);
        return;
      }
      const live = recordLiveMetrics(deviceId, result.data);
      emitToDashboard('device:metrics', { deviceId, metrics: live });
    }),
  );

  socket.on(
    'disconnect',
    safeHandler('disconnect', async () => {
      if (unregisterAgentSocket(deviceId, socket)) {
        await updateStatus(deviceId, 'offline');
      }
    }),
  );
}

export function registerAgentNamespace(io) {
  const namespace = io.of('/agent');
  namespace.use(authenticateAgent);
  namespace.on('connection', handleConnection);
}
