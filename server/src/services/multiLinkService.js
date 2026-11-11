import {
  MULTILINK_DEFAULT_SETTINGS,
  MultiLinkSetting,
} from '../models/MultiLinkSetting.js';
import {
  AgentOfflineError,
  emitToDashboard,
  getAgentSocket,
  isAgentConnected,
} from '../sockets/registry.js';
import { HttpError } from '../utils/httpError.js';
import {
  agentMultiLinkReplySchema,
  agentMultiLinkSnapshotSchema,
  agentMultiLinkSpeedTestReplySchema,
} from '../validators/multiLinkValidators.js';
import { onLinkStatus } from './alertEngine.js';
import { getDevice } from './deviceService.js';
import { deleteMultiLink, getMultiLink, setMultiLink } from './multiLinkStore.js';

const CONFIG_TIMEOUT_MS = 10_000;
const SPEED_TEST_TIMEOUT_MS = 60_000;
const RESET_TIMEOUT_MS = 15_000;

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

// Same as emitToAgent, but turns failures into HTTP errors and validates the reply.
async function requestFromAgent(deviceId, event, payload, timeoutMs, replySchema) {
  let reply;
  try {
    reply = await emitToAgent(deviceId, event, payload, timeoutMs);
  } catch (error) {
    if (error instanceof AgentOfflineError) {
      throw new HttpError(409, 'PC is offline');
    }
    throw new HttpError(504, 'The PC did not answer in time');
  }
  const result = replySchema.safeParse(reply);
  if (!result.success) {
    throw new HttpError(502, 'Invalid reply from the agent');
  }
  return result.data;
}

// ---------- Settings ----------

// The database keeps lines as a list; the API and the agent use { [lineId]: { role, capGb } }.
function toSettingsResponse(doc) {
  if (!doc) {
    return { ...MULTILINK_DEFAULT_SETTINGS, lines: {} };
  }
  const lines = {};
  for (const line of doc.lines) {
    lines[line.lineId] = { role: line.role, capGb: line.capGb ?? null };
  }
  return { mode: doc.mode, sticky: doc.sticky, lines };
}

function findSettings(deviceId) {
  return MultiLinkSetting.findOne({ deviceId }).lean();
}

// Sends the saved multi-link settings to a device's agent (called when it connects).
// Without saved settings the agent keeps its own defaults. Failures are only logged.
export async function pushMultiLinkConfig(deviceId) {
  const doc = await findSettings(deviceId);
  if (!doc || !isAgentConnected(deviceId)) {
    return;
  }
  try {
    const reply = await emitToAgent(
      deviceId,
      'agent:multilink:config',
      toSettingsResponse(doc),
      CONFIG_TIMEOUT_MS,
    );
    if (reply?.ok !== true) {
      console.warn(`[multilink] agent ${deviceId} did not apply the settings`);
    }
  } catch (error) {
    console.warn(`[multilink] could not send settings to ${deviceId}:`, error.message);
  }
}

// Pushes freshly saved settings and returns the agent's answer, or null when it is offline.
async function pushSettingsNow(deviceId, settings) {
  if (!isAgentConnected(deviceId)) {
    return null;
  }
  try {
    const reply = await emitToAgent(deviceId, 'agent:multilink:config', settings, CONFIG_TIMEOUT_MS);
    const result = agentMultiLinkReplySchema.safeParse(reply);
    return result.success ? result.data : { ok: false, output: 'Invalid reply from the agent' };
  } catch (error) {
    if (error instanceof AgentOfflineError) {
      return null;
    }
    return { ok: false, output: 'The PC did not answer in time' };
  }
}

// settings: validated { mode, sticky, lines: { [lineId]: { role, capGb } } }.
export async function saveMultiLinkSettings(deviceId, { mode, sticky, lines }) {
  const device = await getDevice(deviceId);
  const doc = await MultiLinkSetting.findOneAndUpdate(
    { deviceId: device._id },
    {
      mode,
      sticky,
      lines: Object.entries(lines).map(([lineId, line]) => ({ lineId, ...line })),
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean();
  const settings = toSettingsResponse(doc);
  const pushed = await pushSettingsNow(device.id, settings);
  return { settings, pushed };
}

// ---------- Snapshots from the agent ----------

// A line the user turned off is not used, so it never counts as down.
function isEffectivelyUp(line) {
  return line.up || line.role === 'off';
}

// Tells the alert engine about every line whose state changed since the last snapshot.
// On the first snapshot (also after a server restart) every line is reported once,
// so alerts left open from before are closed correctly.
function reportLineStatusChanges(device, previous, current) {
  const before = new Map((previous?.lines ?? []).map((line) => [line.id, line]));

  for (const line of current.lines) {
    const up = isEffectivelyUp(line);
    const old = before.get(line.id);
    before.delete(line.id);
    if (!old || isEffectivelyUp(old) !== up) {
      onLinkStatus(device, { id: line.id, name: line.name }, up);
    }
  }
  // A line that disappeared (phone unplugged) is gone, not down.
  for (const line of before.values()) {
    if (!isEffectivelyUp(line)) {
      onLinkStatus(device, { id: line.id, name: line.name }, true);
    }
  }
}

// device: { id, name }. payload: the agent's multi-link snapshot (untrusted).
export async function handleMultiLinkSnapshot(device, payload) {
  const result = agentMultiLinkSnapshotSchema.safeParse(payload);
  if (!result.success) {
    console.warn(`[multilink] invalid snapshot from ${device.id}`);
    return;
  }
  const multilink = { ...result.data, receivedAt: new Date().toISOString() };
  const previous = setMultiLink(device, multilink);
  emitToDashboard('multilink:update', { deviceId: device.id, multilink });
  reportLineStatusChanges(device, previous, multilink);
}

// Called when a device is deleted: forgets its snapshot, closes its line alerts and deletes its settings.
export function clearMultiLink(deviceId) {
  const entry = deleteMultiLink(deviceId);
  for (const line of entry?.multilink.lines ?? []) {
    onLinkStatus(entry.device, { id: line.id, name: line.name }, true);
  }
  MultiLinkSetting.deleteOne({ deviceId }).catch((error) => {
    console.error(`[multilink] cleanup for ${deviceId} failed:`, error.message);
  });
}

// ---------- REST ----------

export async function getDeviceMultiLink(deviceId) {
  const device = await getDevice(deviceId);
  const doc = await findSettings(device._id);
  return {
    multilink: getMultiLink(device.id),
    settings: toSettingsResponse(doc),
    online: isAgentConnected(device.id),
  };
}

// Throws 404 when the line is not in the latest snapshot, so typos do not reach the agent.
function assertKnownLine(deviceId, lineId) {
  const multilink = getMultiLink(deviceId);
  if (multilink && !multilink.lines.some((line) => line.id === lineId)) {
    throw new HttpError(404, 'Line not found');
  }
}

export async function runLineSpeedTest(deviceId, lineId) {
  const device = await getDevice(deviceId);
  if (!isAgentConnected(device.id)) {
    throw new HttpError(409, 'PC is offline');
  }
  assertKnownLine(device.id, lineId);
  return requestFromAgent(
    device.id,
    'agent:multilink:speedtest',
    { lineId },
    SPEED_TEST_TIMEOUT_MS,
    agentMultiLinkSpeedTestReplySchema,
  );
}

export async function resetLineUsage(deviceId, lineId) {
  const device = await getDevice(deviceId);
  if (!isAgentConnected(device.id)) {
    throw new HttpError(409, 'PC is offline');
  }
  assertKnownLine(device.id, lineId);
  return requestFromAgent(
    device.id,
    'agent:multilink:reset',
    { lineId },
    RESET_TIMEOUT_MS,
    agentMultiLinkReplySchema,
  );
}
