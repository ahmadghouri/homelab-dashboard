import { Router } from 'express';
import {
  deleteNetworkDevice,
  getNetworkDevices,
  patchNetworkDevice,
  postScan,
} from '../controllers/networkController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody, validateObjectId } from '../middleware/validate.js';
import { networkDeviceUpdateSchema } from '../validators/networkValidators.js';

export const networkRoutes = Router();

const adminOnly = requireRole('admin');
const validId = validateObjectId('id');

networkRoutes.use(requireAuth);

networkRoutes.get('/devices', getNetworkDevices);
networkRoutes.patch(
  '/devices/:id',
  adminOnly,
  validId,
  validateBody(networkDeviceUpdateSchema),
  patchNetworkDevice,
);
networkRoutes.delete('/devices/:id', adminOnly, validId, deleteNetworkDevice);
networkRoutes.post('/scan', adminOnly, postScan);
