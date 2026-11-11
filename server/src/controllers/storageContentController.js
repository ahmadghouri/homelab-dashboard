import { StorageFile } from '../models/StorageFile.js';
import { NO_DRIVE_ACCESS_MESSAGE, assertFileAllowed } from '../services/storage/accessService.js';
import { streamFileContent } from '../services/storage/contentService.js';
import { HttpError } from '../utils/httpError.js';

// Inline view needs view permission; ?download=1 also needs download permission.
export async function getFileContent(req, res) {
  const { download } = req.validatedQuery;
  if (download && !req.driveAccess.canDownload) {
    throw new HttpError(403, NO_DRIVE_ACCESS_MESSAGE);
  }
  const file = await StorageFile.findById(req.params.fileId).select('+driveFileId').lean();
  await assertFileAllowed(req.driveAccess, file);
  await streamFileContent(req, res, file, { download, user: req.user });
}
