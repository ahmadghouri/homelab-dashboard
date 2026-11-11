import { Router } from 'express';
import {
  getAccessList,
  getMyAccess,
  putUserAccess,
} from '../controllers/driveAccessController.js';
import { deleteShare, getShares, postShare } from '../controllers/shareController.js';
import {
  deleteFileToTrash,
  deleteTrash,
  getActivity,
  getFileById,
  getFiles,
  getStorageSummary,
  getTrash,
  patchFile,
  postBatch,
  postRestore,
} from '../controllers/storageFileController.js';
import {
  deleteFolder,
  getFolderPath,
  getFolders,
  getFolderTree,
  patchFolder,
  postFolder,
} from '../controllers/storageFolderController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { loadDriveAccess, requireDrive } from '../middleware/driveAccess.js';
import { validateBody, validateObjectId, validateQuery } from '../middleware/validate.js';
import {
  activityQuerySchema,
  batchSchema,
  createFolderSchema,
  createShareSchema,
  deleteForeverSchema,
  driveAccessSchema,
  fileListQuerySchema,
  folderListQuerySchema,
  restoreSchema,
  shareListQuerySchema,
  updateFileSchema,
  updateFolderSchema,
} from '../validators/storageFileValidators.js';

// Drive files, folders, trash, access, shares, activity. Every route checks login and the
// user's Drive permissions; folder scoping is checked in the services.
export const storageFileRoutes = Router();

const adminOnly = requireRole('admin');
const validId = validateObjectId('id');
const canView = requireDrive('canView');
const canUpload = requireDrive('canUpload');
const canDelete = requireDrive('canDelete');
const canShare = requireDrive('canShare');

storageFileRoutes.use(requireAuth, loadDriveAccess);

// Access
storageFileRoutes.get('/me/access', getMyAccess);
storageFileRoutes.get('/access', adminOnly, getAccessList);
storageFileRoutes.put(
  '/access/:userId',
  adminOnly,
  validateObjectId('userId'),
  validateBody(driveAccessSchema),
  putUserAccess,
);

// Folders
storageFileRoutes.get('/folders', canView, validateQuery(folderListQuerySchema), getFolders);
storageFileRoutes.get('/folders/tree', canView, getFolderTree);
storageFileRoutes.get('/folders/:id/path', canView, validId, getFolderPath);
storageFileRoutes.post('/folders', canUpload, validateBody(createFolderSchema), postFolder);
storageFileRoutes.patch(
  '/folders/:id',
  canUpload,
  validId,
  validateBody(updateFolderSchema),
  patchFolder,
);
storageFileRoutes.delete('/folders/:id', canDelete, validId, deleteFolder);

// Files (batch checks move / trash permission per action)
storageFileRoutes.get('/files', canView, validateQuery(fileListQuerySchema), getFiles);
storageFileRoutes.post('/files/batch', canView, validateBody(batchSchema), postBatch);
storageFileRoutes.get('/files/:id', canView, validId, getFileById);
storageFileRoutes.patch('/files/:id', canUpload, validId, validateBody(updateFileSchema), patchFile);
storageFileRoutes.delete('/files/:id', canDelete, validId, deleteFileToTrash);

// Shares
storageFileRoutes.post(
  '/files/:id/shares',
  canShare,
  validId,
  validateBody(createShareSchema),
  postShare,
);
storageFileRoutes.get('/shares', canView, validateQuery(shareListQuerySchema), getShares);
storageFileRoutes.delete('/shares/:id', validId, deleteShare);

// Trash
storageFileRoutes.get('/trash', canDelete, getTrash);
storageFileRoutes.post('/trash/restore', canDelete, validateBody(restoreSchema), postRestore);
storageFileRoutes.delete('/trash', adminOnly, validateBody(deleteForeverSchema), deleteTrash);

// Activity and summary
storageFileRoutes.get('/activity', adminOnly, validateQuery(activityQuerySchema), getActivity);
storageFileRoutes.get('/summary', canView, getStorageSummary);
