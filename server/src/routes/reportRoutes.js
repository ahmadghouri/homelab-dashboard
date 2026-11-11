import { Router } from 'express';
import { getIspReport, getIspReportPdf } from '../controllers/reportController.js';
import { requireAuth } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validate.js';
import { ispReportQuerySchema } from '../validators/internetValidators.js';

export const reportRoutes = Router();

reportRoutes.use(requireAuth);

reportRoutes.get('/isp', validateQuery(ispReportQuerySchema), getIspReport);
reportRoutes.get('/isp.pdf', validateQuery(ispReportQuerySchema), getIspReportPdf);
