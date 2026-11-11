import { Router } from 'express';
import { authRoutes } from './authRoutes.js';
import { healthRoutes } from './healthRoutes.js';

export const apiRoutes = Router();

apiRoutes.use('/health', healthRoutes);
apiRoutes.use('/auth', authRoutes);
