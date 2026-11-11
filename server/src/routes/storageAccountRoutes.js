import { Router } from 'express';
import {
  getAccounts,
  getConnectUrl,
  getRouting,
  getSetup,
  googleCallback,
  patchAccount,
  postSync,
  putRouting,
  removeAccount,
} from '../controllers/storageAccountController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireDrive } from '../middleware/driveAccess.js';
import { validateBody, validateObjectId } from '../middleware/validate.js';
import { routingSchema, updateAccountSchema } from '../validators/storageAccountValidators.js';

// Mounted at /api/storage next to other Drive routers, so middleware is set per route
// (a router-level use() would also run for their paths).
export const storageAccountRoutes = Router();

const admin = [requireAuth, requireRole('admin')];
const validId = validateObjectId('id');

// No login: Google redirects the popup here. The single-use state identifies the admin.
storageAccountRoutes.get('/google/callback', googleCallback);
storageAccountRoutes.get('/google/connect-url', admin, getConnectUrl);
storageAccountRoutes.get('/setup', admin, getSetup);

storageAccountRoutes.get('/accounts', requireAuth, requireDrive('canView'), getAccounts);
storageAccountRoutes.patch(
  '/accounts/:id',
  admin,
  validId,
  validateBody(updateAccountSchema),
  patchAccount,
);
storageAccountRoutes.post('/accounts/:id/sync', admin, validId, postSync);
storageAccountRoutes.delete('/accounts/:id', admin, validId, removeAccount);

storageAccountRoutes.get('/routing', requireAuth, getRouting);
storageAccountRoutes.put('/routing', admin, validateBody(routingSchema), putRouting);
