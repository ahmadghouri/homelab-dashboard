import { z } from 'zod';
import { ROUTING_MODES } from '../services/storage/routingSettings.js';

export const PRIORITY_LIMITS = { min: 0, max: 1000 };

export const updateAccountSchema = z
  .strictObject({
    acceptUploads: z.boolean().optional(),
    priority: z.number().int().min(PRIORITY_LIMITS.min).max(PRIORITY_LIMITS.max).optional(),
  })
  .refine((value) => value.acceptUploads !== undefined || value.priority !== undefined, {
    message: 'Nothing to update',
  });

export const routingSchema = z.strictObject({ mode: z.enum(ROUTING_MODES) });

// Google's redirect. Anything unexpected is treated as a failed sign-in, not a 400.
const param = z.string().max(4096).optional().catch(undefined);
export const oauthCallbackSchema = z.object({ code: param, state: param, error: param });
