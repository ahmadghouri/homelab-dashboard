import { Router } from 'express';
import { getDeviceCommands, postDeviceCommand } from '../controllers/commandController.js';
import {
  getDeviceById,
  getDeviceMetrics,
  getDevices,
  patchDevice,
  postDevice,
  postDeviceToken,
  removeDevice,
} from '../controllers/deviceController.js';
import {
  getMultiLink,
  postLineReset,
  postLineSpeedTest,
  putMultiLinkSettings,
} from '../controllers/multiLinkController.js';
import {
  getLogs,
  getWorkspace,
  getWorkspaceActions,
  postWorkspaceAction,
} from '../controllers/workspaceController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody, validateObjectId, validateQuery } from '../middleware/validate.js';
import { commandListQuerySchema, sendCommandSchema } from '../validators/commandValidators.js';
import { deviceNameSchema, metricsQuerySchema } from '../validators/deviceValidators.js';
import { multiLinkSettingsSchema } from '../validators/multiLinkValidators.js';
import {
  workspaceActionListQuerySchema,
  workspaceActionSchema,
  workspaceLogsQuerySchema,
} from '../validators/workspaceValidators.js';

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
deviceRoutes.get(
  '/:id/commands',
  validId,
  validateQuery(commandListQuerySchema),
  getDeviceCommands,
);
deviceRoutes.post(
  '/:id/commands',
  adminOnly,
  validId,
  validateBody(sendCommandSchema),
  postDeviceCommand,
);

// Developer workspace (M7). Logs are admin only because they may contain secrets.
deviceRoutes.get('/:id/workspace', validId, getWorkspace);
deviceRoutes.get(
  '/:id/workspace/actions',
  validId,
  validateQuery(workspaceActionListQuerySchema),
  getWorkspaceActions,
);
deviceRoutes.post(
  '/:id/workspace/actions',
  adminOnly,
  validId,
  validateBody(workspaceActionSchema),
  postWorkspaceAction,
);
deviceRoutes.get(
  '/:id/workspace/logs',
  adminOnly,
  validId,
  validateQuery(workspaceLogsQuerySchema),
  getLogs,
);

// Multi-Link Manager (M10). The line id in the path is URL-encoded and checked in the controller.
deviceRoutes.get('/:id/multilink', validId, getMultiLink);
deviceRoutes.put(
  '/:id/multilink/settings',
  adminOnly,
  validId,
  validateBody(multiLinkSettingsSchema),
  putMultiLinkSettings,
);
deviceRoutes.post('/:id/multilink/lines/:lineId/speedtest', adminOnly, validId, postLineSpeedTest);
deviceRoutes.post('/:id/multilink/lines/:lineId/reset', adminOnly, validId, postLineReset);
