import { HttpError } from '../utils/httpError.js';
import { streamFileContent } from '../services/storage/contentService.js';
import {
  createShare,
  getPublicShare,
  listShares,
  resolvePublicShare,
  revokeShare,
} from '../services/storage/shareService.js';

export async function postShare(req, res) {
  const share = await createShare(req.driveAccess, req.user, req.params.id, req.body);
  res.status(201).json({ share });
}

export async function getShares(req, res) {
  const shares = await listShares(req.driveAccess, req.user, req.validatedQuery);
  res.json({ shares });
}

export async function deleteShare(req, res) {
  await revokeShare(req.driveAccess, req.user, req.params.id);
  res.status(204).end();
}

// Public (no login).
export async function getPublicShareInfo(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.json(await getPublicShare(req.params.token));
}

export async function getPublicShareContent(req, res) {
  const download = req.query.download === '1' || req.query.download === 'true';
  const { file, allowDownload } = await resolvePublicShare(req.params.token);
  if (download && !allowDownload) {
    throw new HttpError(403, 'Downloads are not allowed for this link');
  }
  await streamFileContent(req, res, file, { download, user: null });
}
