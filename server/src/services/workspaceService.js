import { WorkspaceActionLog } from '../models/WorkspaceActionLog.js';
import {
  AgentOfflineError,
  emitToDashboard,
  getAgentSocket,
  isAgentConnected,
} from '../sockets/registry.js';
import { HttpError } from '../utils/httpError.js';
import {
  agentWorkspaceActionReplySchema,
  agentWorkspaceLogsReplySchema,
  agentWorkspaceSnapshotSchema,
} from '../validators/workspaceValidators.js';
import { onWorkspaceProjectStatus } from './alertEngine.js';
import { getDevice } from './deviceService.js';
import { deleteWorkspace, getWorkspace, setWorkspace } from './workspaceStore.js';

const ACTION_TIMEOUT_MS = 15_000;
const RESTART_TIMEOUT_MS = 30_000;
const LOGS_TIMEOUT_MS = 15_000;

// ---------- Agent round trip ----------

// Sends an event to a PC's agent and waits for its acknowledgement.
// Throws AgentOfflineError without a connection, and Socket.io's timeout error without an answer.
function emitToAgent(deviceId, event, payload, timeoutMs) {
  const socket = getAgentSocket(deviceId);
  if (!socket) {
    throw new AgentOfflineError();
  }
  return socket.timeout(timeoutMs).emitWithAck(event, payload);
}

// ---------- Snapshots from the agent ----------

// The alert engine only knows crashed vs not crashed; a project served by another
// process ("external") counts as running.
function alertStatusOf(status) {
  return status === 'external' ? 'running' : status;
}

// Tells the alert engine about every project whose status changed since the last snapshot.
// On the first snapshot (also after a server restart) every project is reported once,
// so crash alerts left open from before are opened or closed correctly.
async function reportProjectStatusChanges(device, previous, current) {
  const before = new Map((previous?.projects ?? []).map((project) => [project.id, project]));
  const changes = [];

  for (const project of current.projects) {
    const status = alertStatusOf(project.status);
    const old = before.get(project.id);
    before.delete(project.id);
    if (!old || alertStatusOf(old.status) !== status) {
      changes.push([project, status]);
    }
  }
  // Projects removed from workspace.json cannot stay crashed.
  for (const project of before.values()) {
    if (project.status === 'crashed') {
      changes.push([project, 'stopped']);
    }
  }

  for (const [project, status] of changes) {
    await onWorkspaceProjectStatus(
      device,
      { id: project.id, name: project.name, exitCode: project.exitCode },
      status,
    );
  }
}

// device: { id, name }. payload: the agent's workspace snapshot (untrusted).
export async function handleWorkspaceSnapshot(device, payload) {
  const result = agentWorkspaceSnapshotSchema.safeParse(payload);
  if (!result.success) {
    console.warn(`[workspace] invalid snapshot from ${device.id}`);
    return;
  }
  const workspace = { ...result.data, receivedAt: new Date().toISOString() };
  const previous = setWorkspace(device, workspace);
  emitToDashboard('workspace:update', { deviceId: device.id, workspace });
  await reportProjectStatusChanges(device, previous, workspace);
}

// Called when a device is deleted: forgets its snapshot, closes its crash alerts and history.
export function clearWorkspace(deviceId) {
  const entry = deleteWorkspace(deviceId);
  const cleanup = async () => {
    const crashed = entry?.workspace.projects.filter((project) => project.status === 'crashed') ?? [];
    for (const project of crashed) {
      await onWorkspaceProjectStatus(entry.device, project, 'stopped');
    }
    await WorkspaceActionLog.deleteMany({ deviceId });
  };
  cleanup().catch((error) => {
    console.error(`[workspace] cleanup for ${deviceId} failed:`, error.message);
  });
}

// ---------- REST ----------

export async function getDeviceWorkspace(deviceId) {
  const device = await getDevice(deviceId);
  return { workspace: getWorkspace(device.id), online: isAgentConnected(device.id) };
}

// Readable name of the target from the latest snapshot, falling back to its id.
function findTargetName(deviceId, target, id) {
  const workspace = getWorkspace(deviceId);
  const lists = {
    project: workspace?.projects,
    container: workspace?.containers.items,
    service: workspace?.services,
  };
  const item = lists[target]?.find((entry) => entry.id === id);
  return item?.name || id;
}

function emitActionUpdated(log) {
  emitToDashboard('workspace:action', { action: log.toJSON() });
}

async function runActionOnAgent(log) {
  const timeoutMs = log.action === 'restart' ? RESTART_TIMEOUT_MS : ACTION_TIMEOUT_MS;
  try {
    const reply = await emitToAgent(
      log.deviceId.toString(),
      'agent:workspace:action',
      { target: log.target, id: log.targetId, action: log.action },
      timeoutMs,
    );
    const result = agentWorkspaceActionReplySchema.safeParse(reply);
    if (!result.success) {
      return { status: 'failed', output: 'Invalid reply from the agent' };
    }
    return { status: result.data.ok ? 'success' : 'failed', output: result.data.output };
  } catch (error) {
    if (error instanceof AgentOfflineError) {
      return { status: 'failed', output: 'PC is offline' };
    }
    return { status: 'timeout', output: 'The PC did not answer in time' };
  }
}

// Starts, stops or restarts a project, container or OS service on a PC and waits for the result.
// Failed and timed out actions are normal results, not errors.
export async function runWorkspaceAction({ deviceId, target, id, action, user }) {
  const device = await getDevice(deviceId);
  if (!isAgentConnected(device.id)) {
    throw new HttpError(409, 'PC is offline');
  }

  const log = await WorkspaceActionLog.create({
    deviceId: device._id,
    deviceName: device.name,
    userId: user._id,
    userName: user.name,
    target,
    targetId: id,
    targetName: findTargetName(device.id, target, id),
    action,
  });
  emitActionUpdated(log);

  const { status, output } = await runActionOnAgent(log);
  log.status = status;
  log.output = output;
  log.finishedAt = new Date();
  await log.save();
  emitActionUpdated(log);
  return log;
}

export async function listWorkspaceActions(deviceId, { limit }) {
  await getDevice(deviceId);
  return WorkspaceActionLog.find({ deviceId }).sort({ createdAt: -1 }).limit(limit);
}

// Fetches recent log lines of a project or container from the agent.
export async function getWorkspaceLogs(deviceId, { target, id, lines }) {
  const device = await getDevice(deviceId);
  let reply;
  try {
    reply = await emitToAgent(device.id, 'agent:workspace:logs', { target, id, lines }, LOGS_TIMEOUT_MS);
  } catch (error) {
    if (error instanceof AgentOfflineError) {
      throw new HttpError(409, 'PC is offline');
    }
    throw new HttpError(504, 'The PC did not answer in time');
  }
  const result = agentWorkspaceLogsReplySchema.safeParse(reply);
  if (!result.success) {
    throw new HttpError(502, 'Invalid reply from the agent');
  }
  return result.data;
}

// Actions that were waiting for an answer when the server stopped will never get one.
// The Lead should call this at server start (next to markAllDevicesOffline).
export function failPendingWorkspaceActions() {
  return WorkspaceActionLog.updateMany(
    { status: 'pending' },
    { status: 'failed', output: 'Server restarted', finishedAt: new Date() },
  );
}
