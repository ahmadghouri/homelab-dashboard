import { StorageFile, detectFileKind } from '../models/StorageFile.js';
import { StorageFolder } from '../models/StorageFolder.js';
import { emitToDashboard } from '../sockets/registry.js';
import { assertFolderAllowed } from '../services/storage/accessService.js';
import { getAccessToken, syncQuota } from '../services/storage/accountService.js';
import { logActivity } from '../services/storage/activityService.js';
import { deleteFile } from '../services/storage/google/driveApi.js';
import {
  cancelUpload,
  createUpload,
  getUploadStatus,
  startUploadCleanup,
  uploadSessionChunk,
} from '../services/storage/uploadService.js';

function runInBackground(label, promise) {
  Promise.resolve(promise).catch((error) => console.error(`[drive] ${label} failed:`, error.message));
}

// Creates the StorageFile once Google has the whole file. If the target folder was trashed
// or deleted during the upload, the file lands in the root so it never becomes invisible.
async function createFileRecord(session, driveFileId) {
  let folderId = session.folderId ?? null;
  if (folderId) {
    const folder = await StorageFolder.findById(folderId).select('trashedAt').lean();
    if (!folder || folder.trashedAt) {
      folderId = null;
    }
  }
  const file = await StorageFile.create({
    name: session.fileName,
    mimeType: session.mimeType,
    sizeBytes: session.sizeBytes,
    kind: detectFileKind(session.mimeType, session.fileName),
    folderId,
    accountId: session.accountId,
    driveFileId,
    uploadedBy: session.userId,
  });
  const rollback = async () => {
    await StorageFile.deleteOne({ _id: file._id });
    try {
      await deleteFile(await getAccessToken(session.accountId), driveFileId);
    } catch (error) {
      console.error('[drive] removing a cancelled upload failed:', error?.code ?? error?.message);
    }
  };
  return { file, rollback };
}

function afterCompleted(user, file) {
  runInBackground('quota sync', syncQuota(file.accountId));
  runInBackground(
    'activity',
    logActivity({
      user,
      action: 'upload',
      targetType: 'file',
      targetId: file._id,
      targetName: file.name,
      meta: { sizeBytes: file.sizeBytes },
    }),
  );
  emitToDashboard('storage:files', { folderId: file.folderId?.toString() ?? null });
}

export async function postUpload(req, res) {
  startUploadCleanup();
  await assertFolderAllowed(req.driveAccess, req.body.folderId);
  const upload = await createUpload({ user: req.user, ...req.body });
  res.status(201).json(upload);
}

// Raw chunk body: express.json() leaves non-JSON bodies unread, so req is the byte stream.
export async function putUploadChunk(req, res) {
  const result = await uploadSessionChunk({
    uploadId: req.params.id,
    user: req.user,
    contentRange: req.get('content-range'),
    body: req,
    onComplete: createFileRecord,
  });
  if (result.conflict !== undefined) {
    res.status(409).json({
      message: 'Chunk does not start at the upload offset. Resume from the returned offset.',
      offset: result.conflict,
    });
    return;
  }
  if (result.status === 'completed') {
    afterCompleted(req.user, result.file);
  }
  res.json(result);
}

export async function getUpload(req, res) {
  const result = await getUploadStatus({
    uploadId: req.params.id,
    user: req.user,
    onComplete: createFileRecord,
  });
  if (result.status === 'completed' && result.file) {
    afterCompleted(req.user, result.file);
  }
  res.json(result);
}

export async function deleteUpload(req, res) {
  res.json(await cancelUpload({ uploadId: req.params.id, user: req.user }));
}
