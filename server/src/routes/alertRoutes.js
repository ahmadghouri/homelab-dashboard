import { Router } from 'express';
import {
  getAlerts,
  getRules,
  patchRule,
  postAcknowledge,
  postResolve,
} from '../controllers/alertController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody, validateObjectId, validateQuery } from '../middleware/validate.js';
import { alertListQuerySchema, alertRuleUpdateSchema } from '../validators/alertValidators.js';

const adminOnly = requireRole('admin');
const validId = validateObjectId('id');

export const alertRoutes = Router();
alertRoutes.use(requireAuth);
alertRoutes.get('/', validateQuery(alertListQuerySchema), getAlerts);
alertRoutes.post('/:id/acknowledge', adminOnly, validId, postAcknowledge);
alertRoutes.post('/:id/resolve', adminOnly, validId, postResolve);

export const alertRuleRoutes = Router();
alertRuleRoutes.use(requireAuth);
alertRuleRoutes.get('/', getRules);
alertRuleRoutes.patch('/:id', adminOnly, validId, validateBody(alertRuleUpdateSchema), patchRule);
