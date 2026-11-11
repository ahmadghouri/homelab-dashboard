import { Router } from 'express';
import {
  getAppSettings,
  getTelegramChats,
  patchAppSettings,
  postTelegramTest,
} from '../controllers/settingsController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { settingsUpdateSchema } from '../validators/settingsValidators.js';

export const settingsRoutes = Router();

settingsRoutes.use(requireAuth, requireRole('admin'));
settingsRoutes.get('/', getAppSettings);
settingsRoutes.patch('/', validateBody(settingsUpdateSchema), patchAppSettings);
settingsRoutes.post('/telegram/test', postTelegramTest);
settingsRoutes.get('/telegram/chats', getTelegramChats);
