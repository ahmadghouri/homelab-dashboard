import { CommandLog } from '../models/CommandLog.js';
import {
  AgentOfflineError,
  emitToDashboard,
  isAgentConnected,
  sendAgentCommand,
} from '../sockets/registry.js';
import { HttpError } from '../utils/httpError.js';
import { agentCommandReplySchema } from '../validators/commandValidators.js';
import { getDevice } from './deviceService.js';

const COMMAND_ACK_TIMEOUT_MS = 15_000;

function emitCommandUpdated(log) {
  emitToDashboard('command:updated', { command: log.toJSON() });
}

// Turns the agent's acknowledgement (or the lack of one) into a final status and output.
async function runOnAgent(log) {
  try {
    const reply = await sendAgentCommand(
      log.deviceId.toString(),
      { commandId: log.id, command: log.command },
      COMMAND_ACK_TIMEOUT_MS,
    );
    const result = agentCommandReplySchema.safeParse(reply);
    if (!result.success) {
      return { status: 'failed', output: 'Invalid reply from the agent' };
    }
    return { status: result.data.ok ? 'success' : 'failed', output: result.data.output };
  } catch (error) {
    if (error instanceof AgentOfflineError) {
      return { status: 'failed', output: 'PC is offline' };
    }
    // Socket.io rejects with a timeout error when the agent does not acknowledge in time.
    return { status: 'timeout', output: 'The PC did not answer in time' };
  }
}

// Sends one whitelisted command to a PC and waits for the result.
// Failed and timed out commands are normal results, not errors.
export async function sendDeviceCommand({ deviceId, command, user }) {
  const device = await getDevice(deviceId);
  if (!isAgentConnected(device.id)) {
    throw new HttpError(409, 'PC is offline');
  }

  const log = await CommandLog.create({
    deviceId: device._id,
    deviceName: device.name,
    userId: user._id,
    userName: user.name,
    command,
  });
  emitCommandUpdated(log);

  const { status, output } = await runOnAgent(log);
  log.status = status;
  log.output = output;
  log.finishedAt = new Date();
  await log.save();
  emitCommandUpdated(log);
  return log;
}

export async function listDeviceCommands(deviceId, { limit }) {
  await getDevice(deviceId);
  return CommandLog.find({ deviceId }).sort({ createdAt: -1 }).limit(limit);
}
