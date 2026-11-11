import { Router } from 'express';
import { getStatus, postProtection } from '../controllers/dnsController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { dnsProtectionSchema } from '../validators/dnsValidators.js';

// Optional AdGuard Home integration (off unless ADGUARD_URL is set).
export const dnsRoutes = Router();

dnsRoutes.use(requireAuth);
dnsRoutes.get('/status', getStatus);
dnsRoutes.post('/protection', requireRole('admin'), validateBody(dnsProtectionSchema), postProtection);
