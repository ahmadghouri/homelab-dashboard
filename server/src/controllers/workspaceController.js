import {
  getDeviceWorkspace,
  getWorkspaceLogs,
  listWorkspaceActions,
  runWorkspaceAction,
} from '../services/workspaceService.js';

export async function getWorkspace(req, res) {
  res.json(await getDeviceWorkspace(req.params.id));
}

export async function postWorkspaceAction(req, res) {
  const log = await runWorkspaceAction({ deviceId: req.params.id, ...req.body, user: req.user });
  res.json({ action: log.toJSON() });
}

export async function getWorkspaceActions(req, res) {
  const logs = await listWorkspaceActions(req.params.id, req.validatedQuery);
  res.json({ actions: logs.map((log) => log.toJSON()) });
}

export async function getLogs(req, res) {
  res.json(await getWorkspaceLogs(req.params.id, req.validatedQuery));
}
