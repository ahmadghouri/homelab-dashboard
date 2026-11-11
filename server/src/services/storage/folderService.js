import { StorageFile } from '../../models/StorageFile.js';
import { StorageFolder } from '../../models/StorageFolder.js';
import { emitToDashboard } from '../../sockets/registry.js';
import { HttpError } from '../../utils/httpError.js';
import {
  assertFolderAllowed,
  canAccessFolder,
  getAllowedFolderIds,
  hasFullScope,
  NO_DRIVE_ACCESS_MESSAGE,
} from './accessService.js';
import { logActivity } from './activityService.js';

const MAX_DEPTH = 64;

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function notifyFilesChanged(folderId) {
  emitToDashboard('storage:files', { folderId: folderId ? String(folderId) : null });
}

// Rejects a sibling folder with the same name (case-insensitive).
async function assertUniqueName(parentId, name, excludeId) {
  const filter = {
    parentId: parentId ?? null,
    trashedAt: null,
    name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' },
  };
  if (excludeId) {
    filter._id = { $ne: excludeId };
  }
  if (await StorageFolder.exists(filter)) {
    throw new HttpError(409, 'A folder with this name already exists here', {
      name: ['A folder with this name already exists here'],
    });
  }
}

// Folders that a folder-scoped user enters the Drive through (shown at their root).
export async function listEntryFolders(access) {
  const folders = await StorageFolder.find({ _id: { $in: access.folderIds }, trashedAt: null })
    .sort({ name: 1 })
    .collation({ locale: 'en', strength: 2 });
  const entries = [];
  for (const folder of folders) {
    // Nested entries are reachable through their allowed ancestor already.
    if (!(await canAccessFolder(access, folder.parentId))) {
      entries.push(folder);
    }
  }
  return entries;
}

// Child folders of a folder (null = root).
export async function listChildFolders(access, parentId) {
  if (!parentId && !hasFullScope(access)) {
    return listEntryFolders(access);
  }
  await assertFolderAllowed(access, parentId);
  return StorageFolder.find({ parentId: parentId ?? null, trashedAt: null })
    .sort({ name: 1 })
    .collation({ locale: 'en', strength: 2 });
}

// Every non-trashed folder the user can see. For folder-scoped users the entry folders
// are returned as roots (parentId null) so their ancestors stay hidden.
export async function listFolderTree(access) {
  const allowedIds = await getAllowedFolderIds(access);
  const filter = { trashedAt: null };
  if (allowedIds) {
    filter._id = { $in: allowedIds };
  }
  const folders = await StorageFolder.find(filter).select('name parentId color').lean();
  const visible = new Set(folders.map((folder) => folder._id.toString()));
  return folders.map((folder) => {
    const parentId = folder.parentId?.toString() ?? null;
    return {
      id: folder._id.toString(),
      name: folder.name,
      color: folder.color ?? null,
      parentId: parentId && visible.has(parentId) ? parentId : null,
    };
  });
}

// Ancestor chain of a folder, root first, as [{ id, name }]. Folder-scoped users only see
// the part from their entry folder down.
export async function getFolderPath(access, folderId) {
  if (!folderId) {
    return [];
  }
  const chain = [];
  let current = folderId.toString();
  for (let depth = 0; current && depth < MAX_DEPTH; depth += 1) {
    const folder = await StorageFolder.findById(current).select('name parentId').lean();
    if (!folder) {
      break;
    }
    chain.unshift({ id: folder._id.toString(), name: folder.name });
    current = folder.parentId?.toString() ?? null;
  }
  if (hasFullScope(access)) {
    return chain;
  }
  const allowed = new Set(access.folderIds);
  const start = chain.findIndex((item) => allowed.has(item.id));
  return start === -1 ? [] : chain.slice(start);
}

export async function getFolderPathChecked(access, folderId) {
  await assertFolderAllowed(access, folderId);
  return getFolderPath(access, folderId);
}

export async function createFolder(access, user, { name, parentId }) {
  await assertFolderAllowed(access, parentId ?? null);
  await assertUniqueName(parentId, name);
  const folder = await StorageFolder.create({
    name,
    parentId: parentId ?? null,
    createdBy: user._id,
  });
  await logActivity({
    user,
    action: 'folder_create',
    targetType: 'folder',
    targetId: folder.id,
    targetName: folder.name,
  });
  notifyFilesChanged(folder.parentId);
  return folder;
}

// Loads a non-trashed folder the user may change.
export async function findAllowedFolder(access, folderId) {
  const folder = await StorageFolder.findById(folderId);
  if (!folder || folder.trashedAt) {
    throw new HttpError(404, 'Folder not found');
  }
  if (!(await canAccessFolder(access, folder._id))) {
    throw new HttpError(403, NO_DRIVE_ACCESS_MESSAGE);
  }
  return folder;
}

// Throws when target is the folder itself or one of its descendants.
export async function assertNoCycle(folderId, targetParentId) {
  let current = targetParentId ? targetParentId.toString() : null;
  const moving = folderId.toString();
  for (let depth = 0; current && depth < MAX_DEPTH; depth += 1) {
    if (current === moving) {
      throw new HttpError(409, 'A folder cannot be moved into itself or one of its subfolders');
    }
    const folder = await StorageFolder.findById(current).select('parentId').lean();
    current = folder?.parentId?.toString() ?? null;
  }
}

// Moves a folder (already loaded and checked) under a new parent.
export async function moveFolderTo(access, user, folder, parentId) {
  const target = parentId ?? null;
  if (String(folder.parentId ?? '') === String(target ?? '')) {
    return folder;
  }
  await assertFolderAllowed(access, target);
  await assertNoCycle(folder._id, target);
  await assertUniqueName(target, folder.name, folder._id);
  const from = folder.parentId;
  folder.parentId = target;
  await folder.save();
  await logActivity({
    user,
    action: 'move',
    targetType: 'folder',
    targetId: folder.id,
    targetName: folder.name,
    meta: { from: from?.toString() ?? 'root', to: target?.toString() ?? 'root' },
  });
  notifyFilesChanged(from);
  notifyFilesChanged(target);
  return folder;
}

export async function updateFolder(access, user, folderId, { name, parentId, color }) {
  const folder = await findAllowedFolder(access, folderId);
  if (parentId !== undefined) {
    await moveFolderTo(access, user, folder, parentId);
  }
  if (name !== undefined && name !== folder.name) {
    await assertUniqueName(folder.parentId, name, folder._id);
    const previous = folder.name;
    folder.name = name;
    await folder.save();
    await logActivity({
      user,
      action: 'rename',
      targetType: 'folder',
      targetId: folder.id,
      targetName: name,
      meta: { from: previous },
    });
  }
  if (color !== undefined && color !== folder.color) {
    folder.color = color;
    await folder.save();
  }
  notifyFilesChanged(folder.parentId);
  return folder;
}

// All non-trashed descendant folder ids of a folder (not including itself).
async function liveDescendantIds(folderId) {
  const result = [];
  let frontier = [folderId];
  for (let depth = 0; frontier.length > 0 && depth < MAX_DEPTH; depth += 1) {
    const children = await StorageFolder.find({ parentId: { $in: frontier }, trashedAt: null })
      .select('_id')
      .lean();
    frontier = children.map((child) => child._id);
    result.push(...frontier);
  }
  return result;
}

// Moves a folder and everything still inside it to the trash. Items that were already in the
// trash keep their own state; the rest remember the folder so they come back with it.
export async function trashFolderTree(folder, user) {
  const now = new Date();
  const descendants = await liveDescendantIds(folder._id);
  const folderIds = [folder._id, ...descendants];
  await StorageFile.updateMany(
    { folderId: { $in: folderIds }, trashedAt: null },
    { $set: { trashedAt: now, trashedWithFolderId: folder._id } },
  );
  if (descendants.length > 0) {
    await StorageFolder.updateMany(
      { _id: { $in: descendants }, trashedAt: null },
      { $set: { trashedAt: now, trashedWithFolderId: folder._id } },
    );
  }
  folder.trashedAt = now;
  folder.trashedWithFolderId = null;
  await folder.save();
  await logActivity({
    user,
    action: 'trash',
    targetType: 'folder',
    targetId: folder.id,
    targetName: folder.name,
  });
  notifyFilesChanged(folder.parentId);
}

export async function trashFolder(access, user, folderId) {
  const folder = await findAllowedFolder(access, folderId);
  await trashFolderTree(folder, user);
  return folder;
}
