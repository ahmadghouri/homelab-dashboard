import { Router } from 'express';
import {
  getOutages,
  getQuality,
  getSpeedTests,
  getStatus,
  postSpeedTest,
} from '../controllers/internetController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validate.js';
import {
  outagesQuerySchema,
  qualityQuerySchema,
  speedTestsQuerySchema,
} from '../validators/internetValidators.js';

export const internetRoutes = Router();

internetRoutes.use(requireAuth);

internetRoutes.get('/status', getStatus);
internetRoutes.get('/speedtests', validateQuery(speedTestsQuerySchema), getSpeedTests);
internetRoutes.post('/speedtests', requireRole('admin'), postSpeedTest);
internetRoutes.get('/outages', validateQuery(outagesQuerySchema), getOutages);
internetRoutes.get('/quality', validateQuery(qualityQuerySchema), getQuality);
