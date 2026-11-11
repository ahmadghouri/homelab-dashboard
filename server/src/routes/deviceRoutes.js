import { Router } from 'express';
import {
  getDeviceById,
  getDeviceMetrics,
  getDevices,
  patchDevice,
  postDevice,
  postDeviceToken,
  removeDevice,
} from '../controllers/deviceController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody, validateObjectId, validateQuery } from '../middleware/validate.js';
import { deviceNameSchema, metricsQuerySchema } from '../validators/deviceValidators.js';

export const deviceRoutes = Router();

const adminOnly = requireRole('admin');
const validId = validateObjectId('id');

deviceRoutes.use(requireAuth);

deviceRoutes.get('/', getDevices);
deviceRoutes.post('/', adminOnly, validateBody(deviceNameSchema), postDevice);
deviceRoutes.get('/:id', validId, getDeviceById);
deviceRoutes.patch('/:id', adminOnly, validId, validateBody(deviceNameSchema), patchDevice);
deviceRoutes.delete('/:id', adminOnly, validId, removeDevice);
deviceRoutes.post('/:id/token', adminOnly, validId, postDeviceToken);
deviceRoutes.get('/:id/metrics', validId, validateQuery(metricsQuerySchema), getDeviceMetrics);
