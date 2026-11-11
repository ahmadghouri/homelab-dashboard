import { Router } from 'express';
import {
  getServiceChecks,
  getServices,
  patchService,
  postService,
  postServiceCheck,
  removeService,
} from '../controllers/serviceController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody, validateObjectId, validateQuery } from '../middleware/validate.js';
import {
  serviceChecksQuerySchema,
  serviceCreateSchema,
  serviceUpdateSchema,
} from '../validators/serviceValidators.js';

export const serviceRoutes = Router();

const adminOnly = requireRole('admin');
const validId = validateObjectId('id');

serviceRoutes.use(requireAuth);

serviceRoutes.get('/', getServices);
serviceRoutes.post('/', adminOnly, validateBody(serviceCreateSchema), postService);
serviceRoutes.patch('/:id', adminOnly, validId, validateBody(serviceUpdateSchema), patchService);
serviceRoutes.delete('/:id', adminOnly, validId, removeService);
serviceRoutes.post('/:id/check', adminOnly, validId, postServiceCheck);
serviceRoutes.get(
  '/:id/checks',
  validId,
  validateQuery(serviceChecksQuerySchema),
  getServiceChecks,
);
