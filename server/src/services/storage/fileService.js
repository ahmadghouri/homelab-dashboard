import mongoose from 'mongoose';
import { env } from '../../config/env.js';
import { DriveAccess } from '../../models/DriveAccess.js';
import { ShareLink } from '../../models/ShareLink.js';
import { StorageAccount } from '../../models/StorageAccount.js';
import { StorageFile } from '../../models/StorageFile.js';
import { StorageFolder } from '../../models/StorageFolder.js';
import { HttpError } from '../../utils/httpError.js';
import {
  assertFileAllowed,
  assertFolderAllowed,
  canAccessFolder,
  getAllowedFolderIds,
  hasFullScope,
  NO_DRIVE_ACCESS_MESSAGE,
} from './accessService.js';
import { getAccessToken, syncQuota } from './accountService.js';
import { deleteFile } from './google/driveApi.js';
import { logActivity } from './activityService.js';
import {
  findAllowedFolder,
  getFolderPath,
  listChildFolders,
  moveFolderTo,
  notifyFilesChanged,
  trashFolderTree,
} from './folderService.js';

const SORT_FIELDS = { name: 'name', size: 'sizeBytes', createdAt: 'createdAt' };
const NAME_COLLATION = { locale: 'en', strength: 2 };

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toObjectIds(ids) {
  return ids.map((id) => new mongoose.Types.ObjectId(String(id)));
}

// Lists one folder (files paginated, folders all) or searches every allowed folder when q is set.
export async function listFiles(access, query) {
  const { folderId = null, q, kind, accountId, sort = 'name', order = 'asc' } = query;
  const page = query.page ?? 1;
  const limit = query.limit ?? 50;
  const filter = { trashedAt: null };
  let folders;

  if (q) {
    filter.name = { $regex: escapeRegex(q), $options: 'i' };
    const allowedIds = await getAllowedFolderIds(access);
    if (allowedIds) {
      filter.folderId = { $in: allowedIds };
    }
  } else {
    folders = await listChildFolders(access, folderId);
    if (!folderId && !hasFullScope(access)) {
      // Folder-scoped users have no files at the root, only their entry folders.
      return { files: [], folders, total: 0, page, limit };
    }
    filter.folderId = folderId ?? null;
  }
  if (kind) filter.kind = kind;
  if (accountId) filter.accountId = accountId;

  const direction = order === 'desc' ? -1 : 1;
  const [files, total] = await Promise.all([
    StorageFile.find(filter)
      .sort({ [SORT_FIELDS[sort] ?? 'name']: direction, _id: direction })
      .collation(NAME_COLLATION)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('uploadedBy', 'name'),
    StorageFile.countDocuments(filter),
  ]);
  return { files, ...(folders ? { folders } : {}), total, page, limit };
}

async function findAllowedFile(access, fileId, options) {
  const file = await StorageFile.findById(fileId).populate('uploadedBy', 'name');
  await assertFileAllowed(access, file, options);
  return file;
}

export async function getFile(access, fileId) {
  const file = await findAllowedFile(access, fileId);
  const folderPath = await getFolderPath(access, file.folderId);
  return { file, folderPath };
}

export async function updateFile(access, user, fileId, { name, folderId }) {
  const file = await findAllowedFile(access, fileId);
  const from = file.folderId;
  if (folderId !== undefined && String(folderId ?? '') !== String(from ?? '')) {
    await assertFolderAllowed(access, folderId);
    file.folderId = folderId;
    await file.save();
    await logActivity({
      user,
      action: 'move',
      targetType: 'file',
      targetId: file.id,
      targetName: file.name,
      meta: { from: from?.toString() ?? 'root', to: folderId?.toString() ?? 'root' },
    });
    notifyFilesChanged(from);
  }
  if (name !== undefined && name !== file.name) {
    const previous = file.name;
    file.name = name;
    await file.save();
    await logActivity({
      user,
      action: 'rename',
      targetType: 'file',
      targetId: file.id,
      targetName: name,
      meta: { from: previous },
    });
  }
  notifyFilesChanged(file.folderId);
  return file;
}

export async function trashFile(access, user, fileId) {
  const file = await findAllowedFile(access, fileId);
  file.trashedAt = new Date();
  file.trashedWithFolderId = null;
  await file.save();
  await logActivity({
    user,
    action: 'trash',
    targetType: 'file',
    targetId: file.id,
    targetName: file.name,
  });
  notifyFilesChanged(file.folderId);
  return file;
}

// Loads every id or fails with 404 before anything changes.
async function loadAllOrThrow(Model, ids, filter) {
  const unique = [...new Set(ids.map(String))];
  if (unique.length === 0) return [];
  const docs = await Model.find({ _id: { $in: unique }, ...filter });
  if (docs.length !== unique.length) {
    throw new HttpError(404, 'Some of the selected items were not found');
  }
  return docs;
}

// Moves or trashes many files (and optionally folders). Every item is checked before any change.
export async function batchFiles(access, user, { action, ids = [], folderIds = [], folderId }) {
  const permission = action === 'move' ? 'canUpload' : 'canDelete';
  if (!access[permission]) {
    throw new HttpError(403, NO_DRIVE_ACCESS_MESSAGE);
  }
  const files = await loadAllOrThrow(StorageFile, ids, { trashedAt: null });
  for (const file of files) {
    await assertFileAllowed(access, file);
  }
  const folders = [];
  for (const id of new Set(folderIds.map(String))) {
    folders.push(await findAllowedFolder(access, id));
  }
  const target = folderId ?? null;
  if (action === 'move') {
    await assertFolderAllowed(access, target);
  }

  const touched = new Set(files.map((file) => String(file.folderId ?? '')));
  folders.forEach((folder) => touched.add(String(folder.parentId ?? '')));
  if (action === 'move') {
    await StorageFile.updateMany(
      { _id: { $in: files.map((file) => file._id) } },
      { $set: { folderId: target } },
    );
    for (const folder of folders) {
      await moveFolderTo(access, user, folder, target);
    }
    touched.add(String(target ?? ''));
  } else {
    await StorageFile.updateMany(
      { _id: { $in: files.map((file) => file._id) }, trashedAt: null },
      { $set: { trashedAt: new Date(), trashedWithFolderId: null } },
    );
    for (const folder of folders) {
      // A folder may already be in the trash because an earlier one in the list contained it.
      const fresh = await StorageFolder.findById(folder._id);
      if (fresh && !fresh.trashedAt) {
        await trashFolderTree(fresh, user);
      }
    }
  }

  if (files.length > 0) {
    await logActivity({
      user,
      action,
      targetType: 'file',
      targetId: files.length === 1 ? files[0].id : null,
      targetName: files.length === 1 ? files[0].name : `${files.length} files`,
      meta: { count: files.length, ...(action === 'move' ? { to: target?.toString() ?? 'root' } : {}) },
    });
  }
  touched.forEach((id) => notifyFilesChanged(id || null));
  return { files: files.length, folders: folders.length };
}

// Storage totals over all accounts plus file counts in the folders the user can see.
export async function getSummary(access) {
  const allowedIds = await getAllowedFolderIds(access);
  const match = { trashedAt: null };
  if (allowedIds) {
    match.folderId = { $in: toObjectIds(allowedIds) };
  }
  const [accounts, byKind] = await Promise.all([
    StorageAccount.find({ status: { $ne: 'disconnected' } }).select('quota').lean(),
    StorageFile.aggregate([
      { $match: match },
      { $group: { _id: '$kind', count: { $sum: 1 }, bytes: { $sum: '$sizeBytes' } } },
      { $sort: { bytes: -1 } },
    ]),
  ]);
  const unlimited = accounts.some((account) => account.quota?.totalBytes == null);
  const totalBytes = unlimited
    ? null
    : accounts.reduce((sum, account) => sum + (account.quota?.totalBytes ?? 0), 0);
  const usedBytes = accounts.reduce((sum, account) => sum + (account.quota?.usedBytes ?? 0), 0);
  return {
    totalBytes,
    usedBytes,
    freeBytes: totalBytes == null ? null : Math.max(0, totalBytes - usedBytes),
    fileCount: byKind.reduce((sum, item) => sum + item.count, 0),
    byKind: byKind.map((item) => ({ kind: item._id ?? 'other', count: item.count, bytes: item.bytes })),
  };
}

// ---------- Trash ----------

const DAY_MS = 24 * 60 * 60 * 1000;
const TRASH_LIST_LIMIT = 500;
const TOP_LEVEL_TRASH = { trashedAt: { $ne: null }, trashedWithFolderId: null };
const ORIGINAL_FOLDER_GONE =
  'The original folder no longer exists. Ask an admin to restore this item.';

function deleteAt(trashedAt) {
  return new Date(trashedAt.getTime() + env.storage.trashRetentionDays * DAY_MS);
}

// Top-level trashed items (things trashed with a folder come back with that folder).
export async function listTrash(access) {
  const allowedIds = await getAllowedFolderIds(access);
  const fileFilter = { ...TOP_LEVEL_TRASH };
  const folderFilter = { ...TOP_LEVEL_TRASH };
  if (allowedIds) {
    fileFilter.folderId = { $in: allowedIds };
    folderFilter._id = { $in: allowedIds };
  }
  const [files, folders] = await Promise.all([
    StorageFile.find(fileFilter)
      .sort({ trashedAt: -1 })
      .limit(TRASH_LIST_LIMIT)
      .populate('uploadedBy', 'name'),
    StorageFolder.find(folderFilter).sort({ trashedAt: -1 }).limit(TRASH_LIST_LIMIT),
  ]);
  const counts = folders.length
    ? await StorageFile.aggregate([
        { $match: { trashedWithFolderId: { $in: folders.map((folder) => folder._id) } } },
        {
          $group: { _id: '$trashedWithFolderId', count: { $sum: 1 }, bytes: { $sum: '$sizeBytes' } },
        },
      ])
    : [];
  const countById = new Map(counts.map((item) => [item._id.toString(), item]));
  return {
    files: files.map((file) => ({ ...file.toJSON(), deleteAt: deleteAt(file.trashedAt) })),
    folders: folders.map((folder) => {
      const count = countById.get(folder.id);
      return {
        ...folder.toJSON(),
        deleteAt: deleteAt(folder.trashedAt),
        fileCount: count?.count ?? 0,
        sizeBytes: count?.bytes ?? 0,
      };
    }),
  };
}

// The folder an item goes back to: its old folder when that still exists, else the root.
async function restoreTarget(folderId, restoringFolderIds) {
  if (!folderId) return null;
  if (restoringFolderIds.has(folderId.toString())) return folderId;
  const exists = await StorageFolder.exists({ _id: folderId, trashedAt: null });
  return exists ? folderId : null;
}

// Adds " (2)", " (3)" ... when a sibling folder already has the name.
async function freeFolderName(parentId, name, excludeId) {
  for (let attempt = 1; attempt <= 50; attempt += 1) {
    const candidate = attempt === 1 ? name : `${name.slice(0, 110)} (${attempt})`;
    const taken = await StorageFolder.exists({
      _id: { $ne: excludeId },
      parentId: parentId ?? null,
      trashedAt: null,
      name: { $regex: `^${escapeRegex(candidate)}$`, $options: 'i' },
    });
    if (!taken) return candidate;
  }
  return `${name.slice(0, 100)} (${Date.now()})`;
}

export async function restoreItems(access, user, { fileIds = [], folderIds = [] }) {
  const [files, folders] = await Promise.all([
    loadAllOrThrow(StorageFile, fileIds, TOP_LEVEL_TRASH),
    loadAllOrThrow(StorageFolder, folderIds, TOP_LEVEL_TRASH),
  ]);
  const restoring = new Set(folders.map((folder) => folder.id));

  // Check everything before changing anything.
  const folderPlans = [];
  for (const folder of folders) {
    if (!(await canAccessFolder(access, folder._id))) {
      throw new HttpError(403, NO_DRIVE_ACCESS_MESSAGE);
    }
    const target = await restoreTarget(folder.parentId, restoring);
    if (!target && !hasFullScope(access) && !access.folderIds.includes(folder.id)) {
      throw new HttpError(409, ORIGINAL_FOLDER_GONE);
    }
    folderPlans.push({ folder, target });
  }
  const filePlans = [];
  for (const file of files) {
    await assertFileAllowed(access, file, { allowTrashed: true });
    const target = await restoreTarget(file.folderId, restoring);
    if (!target && !hasFullScope(access)) {
      throw new HttpError(409, ORIGINAL_FOLDER_GONE);
    }
    filePlans.push({ file, target });
  }

  const back = { $set: { trashedAt: null, trashedWithFolderId: null } };
  for (const { folder, target } of folderPlans) {
    folder.name = await freeFolderName(target, folder.name, folder._id);
    folder.parentId = target;
    folder.trashedAt = null;
    await folder.save();
    await StorageFolder.updateMany({ trashedWithFolderId: folder._id }, back);
    await StorageFile.updateMany({ trashedWithFolderId: folder._id }, back);
    await logActivity({
      user,
      action: 'restore',
      targetType: 'folder',
      targetId: folder.id,
      targetName: folder.name,
    });
    notifyFilesChanged(target);
  }
  for (const { file, target } of filePlans) {
    file.folderId = target;
    file.trashedAt = null;
    await file.save();
    await logActivity({
      user,
      action: 'restore',
      targetType: 'file',
      targetId: file.id,
      targetName: file.name,
    });
    notifyFilesChanged(target);
  }
  return { files: files.length, folders: folders.length };
}

// Deletes files from Google Drive and then from the database. A file whose Drive delete
// fails stays in the trash (as a top-level item) so a later purge can retry it.
async function deleteFilesForever(fileIds) {
  if (fileIds.length === 0) return { deleted: 0, failed: 0 };
  const files = await StorageFile.find({ _id: { $in: fileIds } })
    .select('+driveFileId accountId')
    .lean();
  const accountIds = [...new Set(files.map((file) => String(file.accountId)))];
  const accounts = await StorageAccount.find({ _id: { $in: accountIds } }).select('_id').lean();
  const existing = new Set(accounts.map((account) => String(account._id)));
  const tokens = new Map();
  const deleted = [];
  const failed = [];
  const touchedAccounts = new Set();

  for (const file of files) {
    const accountId = String(file.accountId);
    try {
      // Without its account the Drive object cannot be reached; only the record is removed.
      if (existing.has(accountId)) {
        if (!tokens.has(accountId)) tokens.set(accountId, getAccessToken(accountId));
        await deleteFile(await tokens.get(accountId), file.driveFileId);
        touchedAccounts.add(accountId);
      }
      deleted.push(file._id);
    } catch (error) {
      failed.push(file._id);
      console.error(
        '[drive] permanent delete failed:',
        error?.code ?? error?.status ?? error?.name,
        `file=${file._id}`,
      );
    }
  }

  if (deleted.length > 0) {
    await StorageFile.deleteMany({ _id: { $in: deleted } });
    await ShareLink.deleteMany({ fileId: { $in: deleted } });
  }
  if (failed.length > 0) {
    await StorageFile.updateMany({ _id: { $in: failed } }, { $set: { trashedWithFolderId: null } });
  }
  for (const accountId of touchedAccounts) {
    syncQuota(accountId).catch((error) =>
      console.error('[drive] quota sync after delete failed:', error?.status ?? error?.code),
    );
  }
  return { deleted: deleted.length, failed: failed.length };
}

// Deletes top-level trashed files and folders (with everything trashed together with them).
async function purge(files, folders) {
  const folderIds = folders.map((folder) => folder._id);
  const inner = folderIds.length
    ? await StorageFile.find({ trashedWithFolderId: { $in: folderIds } }).select('_id').lean()
    : [];
  const result = await deleteFilesForever([
    ...files.map((file) => file._id),
    ...inner.map((file) => file._id),
  ]);
  if (folderIds.length > 0) {
    const subtree = await StorageFolder.find({
      $or: [{ _id: { $in: folderIds } }, { trashedWithFolderId: { $in: folderIds } }],
    })
      .select('_id')
      .lean();
    const ids = subtree.map((folder) => folder._id);
    await StorageFolder.deleteMany({ _id: { $in: ids } });
    await DriveAccess.updateMany(
      { folderIds: { $in: ids } },
      { $pull: { folderIds: { $in: ids } } },
    );
  }
  return { files: result.deleted, folders: folderIds.length, failed: result.failed };
}

// Admin: deletes trashed items forever (Google Drive and database).
export async function deleteForever(user, { fileIds = [], folderIds = [], all = false }) {
  let files;
  let folders;
  if (all) {
    [files, folders] = await Promise.all([
      StorageFile.find(TOP_LEVEL_TRASH).select('_id name'),
      StorageFolder.find(TOP_LEVEL_TRASH).select('_id name'),
    ]);
  } else {
    [files, folders] = await Promise.all([
      loadAllOrThrow(StorageFile, fileIds, TOP_LEVEL_TRASH),
      loadAllOrThrow(StorageFolder, folderIds, TOP_LEVEL_TRASH),
    ]);
  }
  const result = await purge(files, folders);
  const single = !all && files.length + folders.length === 1 ? (files[0] ?? folders[0]) : null;
  let targetType = 'trash';
  if (single) {
    targetType = files.length === 1 ? 'file' : 'folder';
  }
  await logActivity({
    user,
    action: 'delete',
    targetType,
    targetId: single?.id ?? null,
    targetName:
      single?.name ?? (all ? 'Emptied the trash' : `${files.length + folders.length} items`),
    meta: result,
  });
  notifyFilesChanged(null);
  return result;
}

// Trash job: deletes items that have been in the trash longer than the retention period.
export async function purgeExpiredTrash(limit = TRASH_LIST_LIMIT) {
  const cutoff = new Date(Date.now() - env.storage.trashRetentionDays * DAY_MS);
  const filter = { trashedAt: { $ne: null, $lt: cutoff }, trashedWithFolderId: null };
  const [files, folders] = await Promise.all([
    StorageFile.find(filter).select('_id').limit(limit).lean(),
    StorageFolder.find(filter).select('_id').limit(limit).lean(),
  ]);
  if (files.length + folders.length === 0) {
    return { files: 0, folders: 0, failed: 0 };
  }
  const result = await purge(files, folders);
  await logActivity({
    user: null,
    action: 'delete',
    targetType: 'trash',
    targetName: 'Trash cleanup',
    meta: { ...result, retentionDays: env.storage.trashRetentionDays },
  });
  notifyFilesChanged(null);
  return result;
}
