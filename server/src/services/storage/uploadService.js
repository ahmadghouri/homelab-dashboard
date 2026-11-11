import { Transform } from 'node:stream';
import { StorageAccount } from '../../models/StorageAccount.js';
import { UploadSession } from '../../models/UploadSession.js';
import { HttpError } from '../../utils/httpError.js';
import { getAccessToken, releaseSpace, reserveSpace } from './accountService.js';
import { decryptSecret, encryptSecret } from './crypto.js';
import {
  cancelSession,
  createResumableSession,
  ensureAppFolder,
  querySessionOffset,
  uploadChunk,
} from './google/driveApi.js';

export const CHUNK_SIZE = 8 * 1024 * 1024;
export const MAX_CHUNK_BYTES = 32 * 1024 * 1024;
// Google requires every chunk except the last to be a multiple of 256 KiB.
export const CHUNK_ALIGNMENT = 256 * 1024;
// A lock older than this belongs to a request that died (for example a server restart).
const STALE_LOCK_MS = 15 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const CONTENT_RANGE_PATTERN = /^bytes (\d{1,15})-(\d{1,15})\/(\d{1,15})$/;

// Chunks in flight on this server, so a cancel can stop the Google request at once.
const inFlight = new Map();

function notFound() {
  return new HttpError(404, 'Upload not found');
}

// Parses "bytes start-end/total" and checks it against the session. Throws on any mismatch.
export function parseContentRange(header, sizeBytes) {
  const match = CONTENT_RANGE_PATTERN.exec(String(header ?? '').trim());
  if (!match) {
    throw new HttpError(400, 'Content-Range header must look like "bytes start-end/total"');
  }
  const [start, end, total] = match.slice(1).map(Number);
  if (end < start || end >= total) {
    throw new HttpError(400, 'Content-Range is out of order');
  }
  if (total !== sizeBytes) {
    throw new HttpError(400, 'Content-Range total does not match the upload size');
  }
  const length = end - start + 1;
  if (length > MAX_CHUNK_BYTES) {
    throw new HttpError(413, 'Chunk is larger than 32 MiB');
  }
  const isLast = end + 1 === total;
  if (!isLast && length % CHUNK_ALIGNMENT !== 0) {
    throw new HttpError(400, 'Chunk size must be a multiple of 256 KiB (except the last chunk)');
  }
  return { start, end, total, length };
}

// Counts the bytes going through and fails the stream when the client sends more or fewer
// than the Content-Range declared, so Google never receives a mismatched chunk.
function byteLimiter(expected) {
  let seen = 0;
  return new Transform({
    transform(chunk, encoding, callback) {
      seen += chunk.length;
      if (seen > expected) {
        callback(new HttpError(400, 'Chunk body is longer than its Content-Range'));
        return;
      }
      callback(null, chunk);
    },
    flush(callback) {
      callback(seen === expected ? null : new HttpError(400, 'Chunk body is shorter than its Content-Range'));
    },
  });
}

async function appFolderIdFor(account, accessToken) {
  if (account.appFolderId) {
    return account.appFolderId;
  }
  const folderId = await ensureAppFolder(accessToken);
  await StorageAccount.updateOne({ _id: account._id }, { $set: { appFolderId: folderId } });
  return folderId;
}

function safeGoogleError(error, fallback) {
  if (error instanceof HttpError) {
    return error;
  }
  if (error?.code === 'quota_exceeded') {
    return new HttpError(507, 'The Drive account is out of space');
  }
  if (error?.code === 'rate_limited') {
    return new HttpError(503, 'Google Drive is busy. Try again in a moment.');
  }
  console.error('[drive] upload error:', error?.code ?? error?.name ?? 'unknown');
  return new HttpError(502, fallback);
}

// Moves a session out of "uploading" exactly once and releases its reservation with it.
// Returns the updated session, or null when another request already finished it.
async function finishSession(sessionId, status, extra = {}) {
  const session = await UploadSession.findOneAndUpdate(
    { _id: sessionId, status: 'uploading' },
    { $set: { status, chunkLockedAt: null, ...extra } },
    { returnDocument: 'after' },
  );
  if (session) {
    await releaseSpace(session.accountId, session.sizeBytes);
  }
  return session;
}

export async function createUpload({ user, fileName, mimeType, sizeBytes, folderId }) {
  const account = await reserveSpace(sizeBytes);
  try {
    const accessToken = await getAccessToken(account._id);
    const parentId = await appFolderIdFor(account, accessToken);
    const sessionUri = await createResumableSession(accessToken, {
      name: fileName,
      mimeType,
      sizeBytes,
      parentId,
    });
    const session = await UploadSession.create({
      userId: user._id,
      accountId: account._id,
      folderId,
      fileName,
      mimeType,
      sizeBytes,
      sessionUriEnc: encryptSecret(sessionUri),
    });
    return { uploadId: session.id, chunkSize: CHUNK_SIZE, offset: 0 };
  } catch (error) {
    await releaseSpace(account._id, sizeBytes);
    throw safeGoogleError(error, 'Could not start the upload on Google Drive');
  }
}

// Loads a session that belongs to the user (others get 404, so ids cannot be probed).
export async function getOwnSession(uploadId, user, { withUri = false } = {}) {
  const query = UploadSession.findOne({ _id: uploadId, userId: user._id });
  const session = await (withUri ? query.select('+sessionUriEnc') : query);
  if (!session) {
    throw notFound();
  }
  return session;
}

function assertActive(session) {
  if (session.status !== 'uploading') {
    throw new HttpError(409, `Upload is ${session.status}`);
  }
  if (session.expiresAt.getTime() <= Date.now()) {
    throw new HttpError(410, 'Upload session expired. Start the upload again.');
  }
}

// Takes the per-session chunk lock atomically. false when another chunk holds it.
async function acquireChunkLock(sessionId) {
  const now = new Date();
  const locked = await UploadSession.updateOne(
    {
      _id: sessionId,
      status: 'uploading',
      $or: [{ chunkLockedAt: null }, { chunkLockedAt: { $lt: new Date(now - STALE_LOCK_MS) } }],
    },
    { $set: { chunkLockedAt: now } },
  );
  return locked.modifiedCount === 1;
}

async function releaseChunkLock(sessionId, extra = {}) {
  await UploadSession.updateOne(
    { _id: sessionId, status: 'uploading' },
    { $set: { chunkLockedAt: null, ...extra } },
  );
}

// Asks Google where the session really is. Used after any failed chunk and by GET status.
async function resyncOffset(session, sessionUri) {
  try {
    return await querySessionOffset(sessionUri, session.sizeBytes);
  } catch (error) {
    if (error?.code === 'not_found') {
      await finishSession(session._id, 'failed');
      throw new HttpError(410, 'Upload session expired on Google Drive. Start the upload again.');
    }
    throw safeGoogleError(error, 'Could not read the upload state from Google Drive');
  }
}

// Streams one chunk from the request straight into the Google session (nothing is buffered
// or written to disk). `onComplete(session, driveFileId)` creates the file record.
// Returns { conflict: offset } | { status: 'uploading', offset } | { status: 'completed', file }.
export async function uploadSessionChunk({ uploadId, user, contentRange, body, onComplete }) {
  const session = await getOwnSession(uploadId, user, { withUri: true });
  assertActive(session);
  const range = parseContentRange(contentRange, session.sizeBytes);
  if (!(await acquireChunkLock(session._id))) {
    throw new HttpError(409, 'Another chunk of this upload is still in progress');
  }

  const controller = new AbortController();
  inFlight.set(session.id, controller);
  const sessionUri = decryptSecret(session.sessionUriEnc);
  let locked = true;
  try {
    // Re-read the offset under the lock: the previous chunk may have just moved it.
    const current = await UploadSession.findById(session._id).select('offset status').lean();
    if (current.status !== 'uploading') {
      throw new HttpError(409, `Upload is ${current.status}`);
    }
    if (range.start !== current.offset) {
      return { conflict: current.offset };
    }

    let result;
    let bodyError = null;
    try {
      const limited = body.pipe(byteLimiter(range.length));
      limited.once('error', (error) => {
        bodyError = error;
        controller.abort();
      });
      body.once('error', (error) => limited.destroy(error));
      body.once('close', () => {
        if (!body.complete) {
          limited.destroy(new HttpError(400, 'Client stopped sending the chunk'));
        }
      });
      result = await uploadChunk(sessionUri, {
        body: limited,
        start: range.start,
        end: range.end,
        total: range.total,
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted && !bodyError) {
        throw new HttpError(409, 'Upload was cancelled');
      }
      // The chunk may have partly arrived. Google's offset is the truth from here on.
      const state = await resyncOffset(session, sessionUri);
      if (state.done) {
        return completeUpload(session, state.driveFileId, onComplete);
      }
      await releaseChunkLock(session._id, { offset: state.nextOffset });
      locked = false;
      if (bodyError) {
        throw bodyError instanceof HttpError
          ? bodyError
          : new HttpError(400, 'The chunk did not arrive completely. Resume from the last offset.');
      }
      throw safeGoogleError(error, 'Chunk upload to Google Drive failed. Resume from the last offset.');
    }

    if (result.done) {
      return completeUpload(session, result.driveFileId, onComplete);
    }
    await releaseChunkLock(session._id, { offset: result.nextOffset });
    locked = false;
    return { status: 'uploading', offset: result.nextOffset };
  } finally {
    inFlight.delete(session.id);
    if (locked) {
      await releaseChunkLock(session._id);
    }
  }
}

// Creates the file record, then marks the session completed. If the session was cancelled
// meanwhile, the record is removed again by the caller-provided rollback.
async function completeUpload(session, driveFileId, onComplete) {
  const { file, rollback } = await onComplete(session, driveFileId);
  const finished = await finishSession(session._id, 'completed', {
    fileId: file._id,
    offset: session.sizeBytes,
  });
  if (!finished) {
    await rollback();
    throw new HttpError(409, 'Upload was cancelled');
  }
  return { status: 'completed', file };
}

// Current state. While uploading, the offset comes from Google (unless a chunk is in flight).
export async function getUploadStatus({ uploadId, user, onComplete }) {
  const session = await getOwnSession(uploadId, user, { withUri: true });
  if (session.status !== 'uploading' || session.chunkLockedAt || inFlight.has(session.id)) {
    return { status: session.status, offset: session.offset, sizeBytes: session.sizeBytes };
  }
  if (session.expiresAt.getTime() <= Date.now()) {
    await finishSession(session._id, 'failed');
    return { status: 'failed', offset: session.offset, sizeBytes: session.sizeBytes };
  }
  const state = await resyncOffset(session, decryptSecret(session.sessionUriEnc));
  if (state.done) {
    // The last chunk reached Google but its response was lost: finish it now.
    if (!(await acquireChunkLock(session._id))) {
      return { status: 'uploading', offset: session.offset, sizeBytes: session.sizeBytes };
    }
    try {
      const done = await completeUpload(session, state.driveFileId, onComplete);
      return { ...done, offset: session.sizeBytes, sizeBytes: session.sizeBytes };
    } finally {
      await releaseChunkLock(session._id);
    }
  }
  await UploadSession.updateOne(
    { _id: session._id, status: 'uploading', chunkLockedAt: null },
    { $set: { offset: state.nextOffset } },
  );
  return { status: 'uploading', offset: state.nextOffset, sizeBytes: session.sizeBytes };
}

export async function cancelUpload({ uploadId, user }) {
  const session = await getOwnSession(uploadId, user, { withUri: true });
  if (session.status === 'completed') {
    throw new HttpError(409, 'Upload is already completed');
  }
  if (session.status === 'uploading') {
    await finishSession(session._id, 'cancelled');
    inFlight.get(session.id)?.abort();
    // Best effort: Google drops the stored bytes now instead of after a week.
    cancelSession(decryptSecret(session.sessionUriEnc)).catch(() => {});
  }
  return { status: session.status === 'uploading' ? 'cancelled' : session.status };
}

// Fails expired sessions and gives back their reserved space.
export async function cleanupExpiredUploads() {
  const expired = await UploadSession.find({ status: 'uploading', expiresAt: { $lte: new Date() } })
    .select('_id')
    .limit(500)
    .lean();
  for (const { _id } of expired) {
    await finishSession(_id, 'failed');
  }
  return expired.length;
}

let cleanupTimer = null;

function runCleanup() {
  cleanupExpiredUploads().catch((error) =>
    console.error('[drive] upload cleanup failed:', error.message),
  );
}

// Idempotent. Runs once soon after start, then every hour.
export function startUploadCleanup() {
  if (cleanupTimer) {
    return;
  }
  setTimeout(runCleanup, 10 * 1000).unref();
  cleanupTimer = setInterval(runCleanup, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref();
}

export function stopUploadCleanup() {
  clearInterval(cleanupTimer);
  cleanupTimer = null;
}
