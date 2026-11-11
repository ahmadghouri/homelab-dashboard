import { DRIVE_PERMISSIONS, DriveAccess } from '../../models/DriveAccess.js';
import { StorageFolder } from '../../models/StorageFolder.js';
import { User } from '../../models/User.js';
import { HttpError } from '../../utils/httpError.js';

export const NO_DRIVE_ACCESS_MESSAGE = 'You do not have Drive access for this';
const MAX_FOLDER_DEPTH = 64;

// Per-request caches, keyed by the access object (one is created per request).
const folderCaches = new WeakMap();
const subtreeCaches = new WeakMap();

function noAccess() {
  return {
    isAdmin: false,
    canView: false,
    canDownload: false,
    canUpload: false,
    canDelete: false,
    canShare: false,
    scope: 'folders',
    folderIds: [],
  };
}

// Applies the implied rules: every other permission needs view access.
export function normalizePermissions(values) {
  const canView = values.canView === true;
  const result = { canView };
  for (const permission of DRIVE_PERMISSIONS) {
    if (permission !== 'canView') {
      result[permission] = canView && values[permission] === true;
    }
  }
  return result;
}

export function accessFromDocument(user, doc) {
  if (user?.role === 'admin') {
    const all = Object.fromEntries(DRIVE_PERMISSIONS.map((permission) => [permission, true]));
    return { ...all, isAdmin: true, scope: 'all', folderIds: [] };
  }
  if (!doc) {
    return noAccess();
  }
  const scope = doc.scope === 'all' ? 'all' : 'folders';
  return {
    ...noAccess(),
    ...normalizePermissions(doc),
    scope,
    folderIds: scope === 'folders' ? (doc.folderIds ?? []).map(String) : [],
  };
}

// Effective Drive permissions of a user: admins always full, viewers from their DriveAccess
// document, nothing without one.
export async function getEffectiveAccess(user) {
  if (!user) {
    return noAccess();
  }
  if (user.role === 'admin') {
    return accessFromDocument(user, null);
  }
  const doc = await DriveAccess.findOne({ userId: user._id ?? user.id }).lean();
  return accessFromDocument(user, doc);
}

export function hasFullScope(access) {
  return access?.isAdmin === true || (access?.canView === true && access.scope === 'all');
}

function folderCache(access) {
  let cache = folderCaches.get(access);
  if (!cache) {
    cache = new Map();
    folderCaches.set(access, cache);
  }
  return cache;
}

// True when the folder (null = root) is inside the user's allowed area. Walks up the parents
// for folder-scoped users; results are cached per access object (one per request).
export async function canAccessFolder(access, folderId) {
  if (!access?.canView) {
    return false;
  }
  if (hasFullScope(access)) {
    return true;
  }
  if (!folderId) {
    return false;
  }
  const allowed = new Set(access.folderIds);
  const cache = folderCache(access);
  const visited = [];
  let current = folderId.toString();
  let result = false;
  for (let depth = 0; current && depth < MAX_FOLDER_DEPTH; depth += 1) {
    if (cache.has(current)) {
      result = cache.get(current);
      break;
    }
    visited.push(current);
    if (allowed.has(current)) {
      result = true;
      break;
    }
    const folder = await StorageFolder.findById(current).select('parentId').lean();
    current = folder?.parentId?.toString() ?? null;
  }
  for (const id of visited) {
    cache.set(id, result);
  }
  return result;
}

// Throws unless the target folder (null = root) exists, is not trashed and is allowed.
// Returns the folder document (lean) or null for the root.
export async function assertFolderAllowed(access, folderId) {
  if (!access?.canView) {
    throw new HttpError(403, NO_DRIVE_ACCESS_MESSAGE);
  }
  let folder = null;
  if (folderId) {
    folder = await StorageFolder.findById(folderId).lean();
    if (!folder || folder.trashedAt) {
      throw new HttpError(404, 'Folder not found');
    }
  }
  if (!(await canAccessFolder(access, folderId ?? null))) {
    throw new HttpError(403, NO_DRIVE_ACCESS_MESSAGE);
  }
  return folder;
}

// Throws unless the file exists (not trashed unless allowTrashed) and sits in an allowed folder.
export async function assertFileAllowed(access, file, { allowTrashed = false } = {}) {
  if (!access?.canView) {
    throw new HttpError(403, NO_DRIVE_ACCESS_MESSAGE);
  }
  if (!file || (file.trashedAt && !allowTrashed)) {
    throw new HttpError(404, 'File not found');
  }
  if (!(await canAccessFolder(access, file.folderId ?? null))) {
    throw new HttpError(403, NO_DRIVE_ACCESS_MESSAGE);
  }
  return file;
}

// Admin view: every user with their effective Drive access.
export async function listUserAccess() {
  const [users, docs] = await Promise.all([
    User.find().sort({ createdAt: 1 }).lean(),
    DriveAccess.find().lean(),
  ]);
  const docByUser = new Map(docs.map((doc) => [doc.userId.toString(), doc]));
  return users.map((user) => ({
    userId: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    access: accessFromDocument(user, docByUser.get(user._id.toString())),
  }));
}

// Admin: replaces a viewer's Drive permissions. Returns the new effective access.
export async function saveUserAccess(userId, values, actingUser) {
  const user = await User.findById(userId);
  if (!user) {
    throw new HttpError(404, 'User not found');
  }
  if (user.role === 'admin') {
    throw new HttpError(409, 'Admins always have full Drive access');
  }
  const scope = values.scope === 'all' ? 'all' : 'folders';
  const folderIds = scope === 'folders' ? [...new Set((values.folderIds ?? []).map(String))] : [];
  if (folderIds.length > 0) {
    const found = await StorageFolder.countDocuments({ _id: { $in: folderIds } });
    if (found !== folderIds.length) {
      throw new HttpError(400, 'Some selected folders do not exist', {
        folderIds: ['Some selected folders do not exist'],
      });
    }
  }
  const permissions = normalizePermissions(values);
  const doc = await DriveAccess.findOneAndUpdate(
    { userId: user._id },
    { $set: { ...permissions, scope, folderIds, updatedBy: actingUser._id } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).lean();
  return { user, access: accessFromDocument(user, doc) };
}

// Every folder id (trashed or not) inside the user's allowed subtrees, or null when the user
// can see everything. Used to scope list / search / trash queries for folder-scoped users.
export async function getAllowedFolderIds(access) {
  if (hasFullScope(access)) {
    return null;
  }
  if (!access?.canView) {
    return [];
  }
  if (subtreeCaches.has(access)) {
    return subtreeCaches.get(access);
  }
  const seen = new Set();
  let frontier = access.folderIds.filter(Boolean);
  const roots = await StorageFolder.find({ _id: { $in: frontier } }).select('_id').lean();
  frontier = roots.map((folder) => folder._id.toString());
  frontier.forEach((id) => seen.add(id));
  for (let depth = 0; frontier.length > 0 && depth < MAX_FOLDER_DEPTH; depth += 1) {
    const children = await StorageFolder.find({ parentId: { $in: frontier } })
      .select('_id')
      .lean();
    frontier = [];
    for (const child of children) {
      const id = child._id.toString();
      if (!seen.has(id)) {
        seen.add(id);
        frontier.push(id);
      }
    }
  }
  const ids = [...seen];
  subtreeCaches.set(access, ids);
  return ids;
}
