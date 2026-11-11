import { Router } from 'express';
import {
  deleteUpload,
  getUpload,
  postUpload,
  putUploadChunk,
} from '../controllers/storageUploadController.js';
import { requireAuth } from '../middleware/auth.js';
import { loadDriveAccess, requireDrive } from '../middleware/driveAccess.js';
import { validateBody, validateObjectId } from '../middleware/validate.js';
import { createUploadSchema } from '../validators/storageUploadValidators.js';

// Resumable uploads: create a session, PUT raw chunks with Content-Range, poll, cancel.
// Every session route also checks that the session belongs to the logged-in user.
export const storageUploadRoutes = Router();

const validId = validateObjectId('id');
const canUpload = requireDrive('canUpload');

storageUploadRoutes.use(requireAuth, loadDriveAccess);

storageUploadRoutes.post('/', canUpload, validateBody(createUploadSchema), postUpload);
storageUploadRoutes.put('/:id', canUpload, validId, putUploadChunk);
storageUploadRoutes.get('/:id', canUpload, validId, getUpload);
// Cancelling only frees space, so the owner can do it even after losing upload access.
storageUploadRoutes.delete('/:id', validId, deleteUpload);
