import {
  createFolder,
  getFolderPathChecked,
  listChildFolders,
  listFolderTree,
  trashFolder,
  updateFolder,
} from '../services/storage/folderService.js';

export async function getFolders(req, res) {
  const folders = await listChildFolders(req.driveAccess, req.validatedQuery.parentId ?? null);
  res.json({ folders });
}

export async function getFolderTree(req, res) {
  res.json({ folders: await listFolderTree(req.driveAccess) });
}

export async function getFolderPath(req, res) {
  res.json({ path: await getFolderPathChecked(req.driveAccess, req.params.id) });
}

export async function postFolder(req, res) {
  const folder = await createFolder(req.driveAccess, req.user, req.body);
  res.status(201).json({ folder });
}

export async function patchFolder(req, res) {
  const folder = await updateFolder(req.driveAccess, req.user, req.params.id, req.body);
  res.json({ folder });
}

export async function deleteFolder(req, res) {
  await trashFolder(req.driveAccess, req.user, req.params.id);
  res.status(204).end();
}
