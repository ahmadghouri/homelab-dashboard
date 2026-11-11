import { env } from '../../config/env.js';
import { ShareLink } from '../../models/ShareLink.js';
import { StorageFile } from '../../models/StorageFile.js';
import { User } from '../../models/User.js';
import { HttpError } from '../../utils/httpError.js';
import { assertFileAllowed, canAccessFolder, getEffectiveAccess } from './accessService.js';
import { logActivity } from './activityService.js';
import { decryptSecret, encryptSecret, randomToken, sha256 } from './crypto.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const SHARE_LIST_LIMIT = 500;
export const SHARE_NOT_AVAILABLE = 'This link is not available';

function shareUrl(token) {
  return `${env.clientOrigin}/s/${token}`;
}

function isExpired(share, now = Date.now()) {
  return share.expiresAt != null && share.expiresAt.getTime() <= now;
}

// Decrypts the stored token to rebuild the link. Returns null when it cannot be read
// (for example after the encryption key changed).
function urlFromEncrypted(tokenEnc) {
  try {
    return shareUrl(decryptSecret(tokenEnc));
  } catch {
    return null;
  }
}

export async function createShare(access, user, fileId, { expiresInDays = null, allowDownload = true }) {
  const file = await StorageFile.findById(fileId);
  await assertFileAllowed(access, file);
  if (allowDownload && !access.canDownload) {
    throw new HttpError(403, 'You cannot create links that allow downloads');
  }
  const token = randomToken();
  const share = await ShareLink.create({
    fileId: file._id,
    tokenHash: sha256(token),
    tokenEnc: encryptSecret(token),
    createdBy: user._id,
    expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * DAY_MS) : null,
    allowDownload,
  });
  await logActivity({
    user,
    action: 'share',
    targetType: 'file',
    targetId: file.id,
    targetName: file.name,
    meta: { shareId: share.id, expiresInDays: expiresInDays ?? null, allowDownload },
  });
  return { ...share.toJSON(), url: shareUrl(token), fileName: file.name, expired: false };
}

// Active (not revoked) links: the user's own, or every link for admins.
export async function listShares(access, user, { fileId } = {}) {
  const filter = { revokedAt: null };
  if (!access.isAdmin) filter.createdBy = user._id;
  if (fileId) filter.fileId = fileId;
  const shares = await ShareLink.find(filter)
    .select('+tokenEnc')
    .sort({ createdAt: -1 })
    .limit(SHARE_LIST_LIMIT)
    .populate('createdBy', 'name');
  const files = await StorageFile.find({ _id: { $in: shares.map((share) => share.fileId) } })
    .select('name trashedAt')
    .lean();
  const fileById = new Map(files.map((file) => [file._id.toString(), file]));
  const now = Date.now();
  return shares.map((share) => {
    const creator = share.createdBy;
    const file = fileById.get(share.fileId.toString());
    const json = share.toJSON();
    return {
      ...json,
      createdBy: creator?._id?.toString() ?? json.createdBy,
      createdByName: creator?.name ?? null,
      url: urlFromEncrypted(share.tokenEnc),
      fileName: file?.name ?? null,
      fileTrashed: Boolean(file?.trashedAt),
      expired: isExpired(share, now),
    };
  });
}

export async function revokeShare(access, user, shareId) {
  const share = await ShareLink.findById(shareId);
  if (!share || (!access.isAdmin && share.createdBy.toString() !== user.id)) {
    throw new HttpError(404, 'Share link not found');
  }
  if (!share.revokedAt) {
    share.revokedAt = new Date();
    await share.save();
    const file = await StorageFile.findById(share.fileId).select('name').lean();
    await logActivity({
      user,
      action: 'unshare',
      targetType: 'file',
      targetId: share.fileId,
      targetName: file?.name ?? '',
      meta: { shareId: share.id },
    });
  }
  return share;
}

// Finds a usable share by its token. Revoked, expired, trashed, or created by someone who lost
// share access to the file all look the same to the visitor: 404.
export async function resolvePublicShare(token) {
  const notFound = new HttpError(404, SHARE_NOT_AVAILABLE);
  const share = await ShareLink.findOne({ tokenHash: sha256(token), revokedAt: null });
  if (!share || isExpired(share)) throw notFound;
  const file = await StorageFile.findById(share.fileId).select('+driveFileId');
  if (!file || file.trashedAt) throw notFound;
  const creator = await User.findById(share.createdBy);
  const access = await getEffectiveAccess(creator);
  if (!access.canShare || !(await canAccessFolder(access, file.folderId))) throw notFound;
  return { share, file, allowDownload: share.allowDownload && access.canDownload };
}

export async function getPublicShare(token) {
  const { share, file, allowDownload } = await resolvePublicShare(token);
  await ShareLink.updateOne(
    { _id: share._id },
    { $inc: { views: 1 }, $set: { lastViewedAt: new Date() } },
  );
  return {
    file: { name: file.name, mimeType: file.mimeType, kind: file.kind, sizeBytes: file.sizeBytes },
    allowDownload,
    expiresAt: share.expiresAt,
  };
}
