import { apiClient } from '@/api/client';

// All Drive (Storage Hub) endpoints. Components never call these directly; they use the hooks.

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

function toQuery(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

// ---- Accounts, setup, routing (S2) ----

// Returns { accounts, summary: { totalBytes | null, usedBytes, freeBytes | null, accounts, connected } }.
export async function getAccounts({ signal } = {}) {
  const data = await apiClient.get('/storage/accounts', { signal });
  return { accounts: data?.accounts ?? [], summary: data?.summary ?? null };
}

// Returns { googleConfigured, redirectUri } (admin).
export function getSetup({ signal } = {}) {
  return apiClient.get('/storage/setup', { signal });
}

// Returns the Google consent URL (admin). 409 when Google is not configured.
export async function getConnectUrl() {
  const data = await apiClient.get('/storage/google/connect-url');
  return data.url;
}

export async function updateAccount({ id, ...changes }) {
  const data = await apiClient.patch(`/storage/accounts/${id}`, changes);
  return data?.account ?? data;
}

export async function syncAccount(id) {
  const data = await apiClient.post(`/storage/accounts/${id}/sync`);
  return data?.account ?? data;
}

// 409 { message, details: { files } } while the account still holds files.
export function deleteAccount(id) {
  return apiClient.delete(`/storage/accounts/${id}`);
}

// Returns { mode: 'most_free' | 'round_robin' | 'priority' }.
export function getRouting({ signal } = {}) {
  return apiClient.get('/storage/routing', { signal });
}

export function updateRouting(mode) {
  return apiClient.put('/storage/routing', { mode });
}

// ---- Access (S3) ----

// Returns [{ userId, name, email, role, access }] (admin).
export async function getAccessList({ signal } = {}) {
  const data = await apiClient.get('/storage/access', { signal });
  return data?.users ?? [];
}

export async function saveAccess({ userId, ...access }) {
  const data = await apiClient.put(`/storage/access/${userId}`, access);
  return data?.access ?? data;
}

// Returns the effective access of the logged-in user:
// { canView, canDownload, canUpload, canDelete, canShare, scope, folderIds }.
export async function getMyAccess({ signal } = {}) {
  const data = await apiClient.get('/storage/me/access', { signal });
  return data?.access ?? data;
}

// ---- Folders (S3) ----

export async function getFolders(parentId, { signal } = {}) {
  const data = await apiClient.get(`/storage/folders${toQuery({ parentId })}`, { signal });
  return data?.folders ?? [];
}

// Returns every non-trashed folder the user can see: [{ id, name, parentId }].
export async function getFolderTree({ signal } = {}) {
  const data = await apiClient.get('/storage/folders/tree', { signal });
  return data?.folders ?? [];
}

// Returns the breadcrumb from the root down to the folder: [{ id, name }].
export async function getFolderPath(folderId, { signal } = {}) {
  const data = await apiClient.get(`/storage/folders/${folderId}/path`, { signal });
  return data?.path ?? data?.folders ?? [];
}

export async function createFolder({ name, parentId = null }) {
  const data = await apiClient.post('/storage/folders', { name, parentId });
  return data?.folder ?? data;
}

export async function updateFolder({ id, ...changes }) {
  const data = await apiClient.patch(`/storage/folders/${id}`, changes);
  return data?.folder ?? data;
}

// Moves the folder and its whole subtree to the trash.
export function trashFolder(id) {
  return apiClient.delete(`/storage/folders/${id}`);
}

// ---- Files (S3) ----

// params: { folderId, q, kind, accountId, sort, order, page, limit }.
// Returns { files, folders (only without q), total, page, limit }.
export async function getFiles(params = {}, { signal } = {}) {
  const data = await apiClient.get(`/storage/files${toQuery(params)}`, { signal });
  return {
    files: data?.files ?? [],
    folders: data?.folders ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    limit: data?.limit ?? 50,
  };
}

// Returns { file, folderPath }.
export function getFile(id, { signal } = {}) {
  return apiClient.get(`/storage/files/${id}`, { signal });
}

export async function updateFile({ id, ...changes }) {
  const data = await apiClient.patch(`/storage/files/${id}`, changes);
  return data?.file ?? data;
}

// action: 'move' (needs folderId, null = root) | 'trash'; ids / folderIds: up to 200 each.
export function batchFiles({ action, ids = [], folderIds = [], folderId }) {
  return apiClient.post('/storage/files/batch', { action, ids, folderIds, folderId });
}

export function trashFile(id) {
  return apiClient.delete(`/storage/files/${id}`);
}

// ---- Trash (S3) ----

// Returns { files, folders } (top-level trashed items only).
export async function getTrash({ signal } = {}) {
  const data = await apiClient.get('/storage/trash', { signal });
  return { files: data?.files ?? [], folders: data?.folders ?? [] };
}

export function restoreFromTrash({ fileIds = [], folderIds = [] }) {
  return apiClient.post('/storage/trash/restore', { fileIds, folderIds });
}

// Admin only. Pass { all: true } to empty the trash (the shared client forwards a DELETE body).
export function deleteFromTrash({ fileIds, folderIds, all } = {}) {
  return apiClient.delete('/storage/trash', {
    body: all ? { all: true } : { fileIds: fileIds ?? [], folderIds: folderIds ?? [] },
  });
}

// ---- Summary and activity (S3) ----

// Returns { totalBytes | null, usedBytes, freeBytes | null, fileCount, byKind: [{ kind, count, bytes }] }.
export function getSummary({ signal } = {}) {
  return apiClient.get('/storage/summary', { signal });
}

export async function getActivity(limit = 50, { signal } = {}) {
  const data = await apiClient.get(`/storage/activity${toQuery({ limit })}`, { signal });
  return data?.activity ?? data?.items ?? [];
}

// ---- Shares (S3) ----

// options: { expiresInDays: 1..365 | null, allowDownload }. Returns { id, url, expiresAt, allowDownload }.
export async function createShare({ fileId, ...options }) {
  const data = await apiClient.post(`/storage/files/${fileId}/shares`, options);
  return data?.share ?? data;
}

// Own shares (admins see all), each with its url.
export async function getShares({ signal } = {}) {
  const data = await apiClient.get('/storage/shares', { signal });
  return data?.shares ?? [];
}

export function revokeShare(id) {
  return apiClient.delete(`/storage/shares/${id}`);
}

// ---- Uploads (S4). Chunk PUTs send a raw body, so they use fetch here, not apiClient. ----

// Returns { uploadId, chunkSize, offset }.
export function createUpload({ fileName, mimeType, sizeBytes, folderId = null }) {
  return apiClient.post('/storage/uploads', { fileName, mimeType, sizeBytes, folderId });
}

// Returns { status, offset }.
export function getUploadStatus(uploadId, { signal } = {}) {
  return apiClient.get(`/storage/uploads/${uploadId}`, { signal });
}

export function cancelUpload(uploadId) {
  return apiClient.delete(`/storage/uploads/${uploadId}`);
}

// ---- Content URLs (used directly as <img src>, <video src> or download links) ----

export function contentPath(fileId, { download = false } = {}) {
  return `${BASE_URL}/storage/content/${fileId}${download ? '?download=1' : ''}`;
}

// ---- Public share links (no login) ----

// Returns { file: { name, mimeType, kind, sizeBytes }, allowDownload, expiresAt }; 404 when not available.
export function getPublicShare(token, { signal } = {}) {
  return apiClient.get(`/public/shares/${encodeURIComponent(token)}`, { signal });
}

export function publicContentPath(token, { download = false } = {}) {
  return `${BASE_URL}/public/shares/${encodeURIComponent(token)}/content${download ? '?download=1' : ''}`;
}

export function uploadChunkPath(uploadId) {
  return `${BASE_URL}/storage/uploads/${uploadId}`;
}
