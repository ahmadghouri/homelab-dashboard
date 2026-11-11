import { listActivity } from '../services/storage/activityService.js';
import {
  batchFiles,
  deleteForever,
  getFile,
  getSummary,
  listFiles,
  listTrash,
  restoreItems,
  trashFile,
  updateFile,
} from '../services/storage/fileService.js';

export async function getFiles(req, res) {
  res.json(await listFiles(req.driveAccess, req.validatedQuery));
}

export async function getFileById(req, res) {
  res.json(await getFile(req.driveAccess, req.params.id));
}

export async function patchFile(req, res) {
  const file = await updateFile(req.driveAccess, req.user, req.params.id, req.body);
  res.json({ file });
}

export async function deleteFileToTrash(req, res) {
  await trashFile(req.driveAccess, req.user, req.params.id);
  res.status(204).end();
}

export async function postBatch(req, res) {
  res.json(await batchFiles(req.driveAccess, req.user, req.body));
}

export async function getTrash(req, res) {
  res.json(await listTrash(req.driveAccess));
}

export async function postRestore(req, res) {
  res.json({ restored: await restoreItems(req.driveAccess, req.user, req.body) });
}

export async function deleteTrash(req, res) {
  res.json({ deleted: await deleteForever(req.user, req.body) });
}

export async function getStorageSummary(req, res) {
  res.json(await getSummary(req.driveAccess));
}

export async function getActivity(req, res) {
  const activity = await listActivity({ limit: req.validatedQuery.limit });
  res.json({ activity });
}
