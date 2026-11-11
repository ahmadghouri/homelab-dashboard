import { Router } from 'express';
import {
  deleteBlock,
  deleteTrack,
  getDevices,
  getStatus,
  postBlock,
  postTrack,
  putPriority,
} from '../controllers/routerController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody, validateObjectId } from '../middleware/validate.js';
import { routerPrioritySchema } from '../validators/routerValidators.js';

// Optional MikroTik integration. :id is a NetworkDevice id.
export const routerRoutes = Router();

const adminOnly = requireRole('admin');
const validId = validateObjectId('id');

routerRoutes.use(requireAuth);

routerRoutes.get('/status', getStatus);
routerRoutes.get('/devices', getDevices);
routerRoutes.post('/devices/:id/track', adminOnly, validId, postTrack);
routerRoutes.delete('/devices/:id/track', adminOnly, validId, deleteTrack);
routerRoutes.put(
  '/devices/:id/priority',
  adminOnly,
  validId,
  validateBody(routerPrioritySchema),
  putPriority,
);
routerRoutes.post('/devices/:id/block', adminOnly, validId, postBlock);
routerRoutes.delete('/devices/:id/block', adminOnly, validId, deleteBlock);
