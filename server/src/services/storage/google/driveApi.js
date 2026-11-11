// Google Drive v3 REST subset over plain fetch. Every Drive call takes the access token first.
// Resumable upload session URIs are bearer secrets: never log them or put them in errors.
import { Readable } from 'node:stream';
import { env } from '../../../config/env.js';
import { GoogleApiError, errorFromFetchFailure, errorFromResponse } from './errors.js';

const REQUEST_TIMEOUT_MS = 30_000;
const RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 5000;
const FOLDER_MIME = 'application/vnd.google-apps.folder';
export const APP_FOLDER_NAME = 'Homelab Drive';

function apiUrl(path, query) {
  const url = new URL(path, env.storage.googleApiBase);
  if (query) {
    url.search = new URLSearchParams(query).toString();
  }
  return url;
}

function authHeaders(accessToken, extra = {}) {
  return { Accept: 'application/json', Authorization: `Bearer ${accessToken}`, ...extra };
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function retryDelay(response) {
  const seconds = Number(response.headers.get('retry-after'));
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.min(seconds * 1000, MAX_RETRY_DELAY_MS);
  }
  return RETRY_DELAY_MS;
}

function shouldRetry(status) {
  return status === 429 || status >= 500;
}

// Non-stream request with a 30 s timeout. `retry` (only for idempotent calls) retries once on 429 / 5xx.
// `accept` lists extra non-2xx statuses that are returned instead of thrown.
async function request(url, { method = 'GET', headers, body, retry = false, accept = [] } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    let response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body,
        redirect: 'manual',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw errorFromFetchFailure(error);
    }
    if (response.ok || accept.includes(response.status)) {
      return response;
    }
    if (retry && attempt === 0 && shouldRetry(response.status)) {
      await response.body?.cancel().catch(() => {});
      await sleep(retryDelay(response));
      continue;
    }
    throw await errorFromResponse(response);
  }
}

async function readJson(response) {
  const data = await response.json().catch(() => null);
  if (!data || typeof data !== 'object') {
    throw new GoogleApiError('Google Drive sent an invalid response', { status: response.status, code: 'server' });
  }
  return data;
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

// Escapes a value for a single-quoted string in a Drive `q` query.
export function escapeQueryValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// totalBytes is null when the account has unlimited storage.
export async function getQuota(accessToken) {
  const response = await request(apiUrl('/drive/v3/about', { fields: 'storageQuota' }), {
    headers: authHeaders(accessToken),
    retry: true,
  });
  const quota = (await readJson(response)).storageQuota ?? {};
  return {
    totalBytes: quota.limit === undefined || quota.limit === null ? null : toNumber(quota.limit),
    usedBytes: toNumber(quota.usage),
    trashBytes: toNumber(quota.usageInDriveTrash),
  };
}

// Finds the app folder in My Drive root, or creates it. With the drive.file scope only folders this
// app created are visible, so a user's own folder with the same name is never picked up.
export async function ensureAppFolder(accessToken, name = APP_FOLDER_NAME) {
  const q = [
    `name = '${escapeQueryValue(name)}'`,
    `mimeType = '${FOLDER_MIME}'`,
    'trashed = false',
    "'root' in parents",
  ].join(' and ');
  const listResponse = await request(
    apiUrl('/drive/v3/files', { q, spaces: 'drive', fields: 'files(id,name)', pageSize: '10' }),
    { headers: authHeaders(accessToken), retry: true },
  );
  const existing = (await readJson(listResponse)).files;
  if (Array.isArray(existing) && existing[0]?.id) {
    return existing[0].id;
  }
  const createResponse = await request(apiUrl('/drive/v3/files', { fields: 'id' }), {
    method: 'POST',
    headers: authHeaders(accessToken, { 'Content-Type': 'application/json; charset=UTF-8' }),
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: ['root'] }),
  });
  const created = await readJson(createResponse);
  if (!created.id) {
    throw new GoogleApiError('Google Drive did not return the folder id', { status: createResponse.status, code: 'server' });
  }
  return created.id;
}

// Starts a resumable upload and returns the session URI (a secret: store it encrypted).
export async function createResumableSession(accessToken, { name, mimeType, sizeBytes, parentId }) {
  const contentType = mimeType || 'application/octet-stream';
  const metadata = { name, mimeType: contentType, ...(parentId ? { parents: [parentId] } : {}) };
  const response = await request(apiUrl('/upload/drive/v3/files', { uploadType: 'resumable', fields: 'id,size' }), {
    method: 'POST',
    headers: authHeaders(accessToken, {
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': contentType,
      'X-Upload-Content-Length': String(sizeBytes),
    }),
    body: JSON.stringify(metadata),
  });
  await response.body?.cancel().catch(() => {});
  const location = response.headers.get('location');
  if (!location || !/^https?:\/\//i.test(location)) {
    throw new GoogleApiError('Google Drive did not start the upload', { status: response.status, code: 'server' });
  }
  return location;
}

// "bytes=0-N" -> N + 1; no header means nothing was stored yet.
function offsetFromRange(rangeHeader) {
  const match = /^bytes=0-(\d+)$/.exec((rangeHeader ?? '').trim());
  return match ? Number(match[1]) + 1 : 0;
}

async function uploadResult(response) {
  if (response.status === 308) {
    await response.body?.cancel().catch(() => {});
    return { done: false, nextOffset: offsetFromRange(response.headers.get('range')) };
  }
  const data = await readJson(response);
  if (!data.id) {
    throw new GoogleApiError('Google Drive did not return the file id', { status: response.status, code: 'server' });
  }
  return { done: true, driveFileId: data.id, sizeBytes: toNumber(data.size) };
}

function toWebStream(body) {
  if (body instanceof Readable) {
    return Readable.toWeb(body);
  }
  return body;
}

function sessionError(error) {
  if (error.code === 'not_found') {
    return new GoogleApiError('The Google Drive upload session expired. Start the upload again', {
      status: error.status,
      code: 'not_found',
    });
  }
  return error;
}

// Sends bytes start..end (inclusive) of a `total`-byte upload. `body` is a web ReadableStream, a
// Node Readable (for example the Express request) or a Buffer / Uint8Array. Streams are sent as-is
// (duplex 'half'), never buffered, and never retried: after a failure ask querySessionOffset().
export async function uploadChunk(sessionUri, { body, start, end, total, signal }) {
  let response;
  try {
    response = await fetch(sessionUri, {
      method: 'PUT',
      headers: {
        'Content-Length': String(end - start + 1),
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Content-Type': 'application/octet-stream',
      },
      body: toWebStream(body),
      duplex: 'half',
      redirect: 'manual',
      signal,
    });
  } catch (error) {
    if (signal?.aborted) {
      throw signal.reason ?? error;
    }
    throw errorFromFetchFailure(error);
  }
  if (response.status !== 308 && !response.ok) {
    throw sessionError(await errorFromResponse(response));
  }
  return uploadResult(response);
}

// Asks Google how many bytes it stored. Returns { done: true, nextOffset: total, driveFileId } when
// the upload already completed.
export async function querySessionOffset(sessionUri, total) {
  let response;
  try {
    response = await request(sessionUri, {
      method: 'PUT',
      headers: { 'Content-Length': '0', 'Content-Range': `bytes */${total}` },
      retry: true,
      accept: [308],
    });
  } catch (error) {
    throw error instanceof GoogleApiError ? sessionError(error) : error;
  }
  const result = await uploadResult(response);
  return result.done ? { done: true, nextOffset: total, driveFileId: result.driveFileId } : result;
}

// Cancels a resumable session (best effort; Google answers 499).
export async function cancelSession(sessionUri) {
  try {
    const response = await fetch(sessionUri, {
      method: 'DELETE',
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    await response.body?.cancel().catch(() => {});
    return true;
  } catch {
    return false;
  }
}

// Opens the file bytes as a web ReadableStream. `range` is a Range header value ("bytes=0-99").
// The 30 s timeout covers only the response headers; `signal` aborts the transfer at any time (the
// caller's AbortError is rethrown as-is). A 416 throws GoogleApiError code 'invalid_range'.
export async function openDownload(accessToken, driveFileId, { range, signal } = {}) {
  const headerTimeout = new AbortController();
  const timer = setTimeout(() => {
    headerTimeout.abort(new DOMException('Google Drive did not answer in time', 'TimeoutError'));
  }, REQUEST_TIMEOUT_MS);
  const signals = signal ? [signal, headerTimeout.signal] : [headerTimeout.signal];

  let response;
  try {
    response = await fetch(apiUrl(`/drive/v3/files/${encodeURIComponent(driveFileId)}`, { alt: 'media' }), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(range ? { Range: range } : {}),
      },
      redirect: 'follow',
      signal: AbortSignal.any(signals),
    });
  } catch (error) {
    if (signal?.aborted) {
      throw signal.reason ?? error;
    }
    throw errorFromFetchFailure(headerTimeout.signal.aborted ? { name: 'TimeoutError' } : error);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw await errorFromResponse(response);
  }
  const contentLength = response.headers.get('content-length');
  return {
    status: response.status === 206 ? 206 : 200,
    headers: {
      contentLength: contentLength === null ? null : toNumber(contentLength),
      contentRange: response.headers.get('content-range'),
      contentType: response.headers.get('content-type'),
    },
    body: response.body,
  };
}

// Deletes permanently (skips the Drive trash). Returns false when the file was already gone.
export async function deleteFile(accessToken, driveFileId) {
  const response = await request(apiUrl(`/drive/v3/files/${encodeURIComponent(driveFileId)}`), {
    method: 'DELETE',
    headers: authHeaders(accessToken),
    retry: true,
    accept: [404],
  });
  await response.body?.cancel().catch(() => {});
  return response.status !== 404;
}

export async function renameFile(accessToken, driveFileId, name) {
  const response = await request(apiUrl(`/drive/v3/files/${encodeURIComponent(driveFileId)}`, { fields: 'id,name' }), {
    method: 'PATCH',
    headers: authHeaders(accessToken, { 'Content-Type': 'application/json; charset=UTF-8' }),
    body: JSON.stringify({ name }),
    retry: true,
  });
  const data = await readJson(response);
  return { id: data.id, name: data.name };
}
