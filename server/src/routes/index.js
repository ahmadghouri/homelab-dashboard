import { Router } from 'express';
import { authRoutes } from './authRoutes.js';
import { deviceRoutes } from './deviceRoutes.js';
import { healthRoutes } from './healthRoutes.js';

export const apiRoutes = Router();

apiRoutes.use('/health', healthRoutes);
apiRoutes.use('/auth', authRoutes);
apiRoutes.use('/devices', deviceRoutes);
