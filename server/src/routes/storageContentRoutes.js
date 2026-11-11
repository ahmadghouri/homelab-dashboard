import { Router } from 'express';
import { getFileContent } from '../controllers/storageContentController.js';
import { requireAuth } from '../middleware/auth.js';
import { loadDriveAccess, requireDrive } from '../middleware/driveAccess.js';
import { validateObjectId, validateQuery } from '../middleware/validate.js';
import { contentQuerySchema } from '../validators/storageUploadValidators.js';

// File bytes for preview (inline) and download (?download=1), streamed from Google Drive.
export const storageContentRoutes = Router();

storageContentRoutes.use(requireAuth, loadDriveAccess);

storageContentRoutes.get(
  '/:fileId',
  validateObjectId('fileId'),
  requireDrive('canView'),
  validateQuery(contentQuerySchema),
  getFileContent,
);
