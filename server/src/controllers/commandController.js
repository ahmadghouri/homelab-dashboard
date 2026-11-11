import { listDeviceCommands, sendDeviceCommand } from '../services/commandService.js';

export async function postDeviceCommand(req, res) {
  const log = await sendDeviceCommand({
    deviceId: req.params.id,
    command: req.body.command,
    user: req.user,
  });
  res.json({ command: log.toJSON() });
}

export async function getDeviceCommands(req, res) {
  const logs = await listDeviceCommands(req.params.id, req.validatedQuery);
  res.json({ commands: logs.map((log) => log.toJSON()) });
}
