import { Router } from 'express';
import { getMe, login, logout } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimiters.js';
import { validateBody } from '../middleware/validate.js';
import { loginSchema } from '../validators/authValidators.js';

export const authRoutes = Router();

authRoutes.post('/login', loginLimiter, validateBody(loginSchema), login);
authRoutes.post('/logout', logout);
authRoutes.get('/me', requireAuth, getMe);
