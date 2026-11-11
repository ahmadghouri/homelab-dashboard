import { z } from 'zod';
import { ALERT_SEVERITIES } from '../models/AlertRule.js';

export const alertListQuerySchema = z.object({
  status: z.enum(['open', 'resolved', 'all']).default('open'),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

// Number ranges per rule type are checked in the service (they differ per rule).
export const alertRuleUpdateSchema = z
  .object({
    enabled: z.boolean().optional(),
    threshold: z.number().finite().optional(),
    durationSec: z.number().int().nonnegative().optional(),
    severity: z.enum(ALERT_SEVERITIES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' });
