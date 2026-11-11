import { z } from 'zod';
import { SERVICE_TYPES } from '../models/Service.js';
import { targetError } from '../services/serviceCheck.js';
import { CHECK_RANGES } from '../services/serviceMonitor.js';

const fields = {
  name: z.string().trim().min(1, 'Name is required').max(60, 'Name is too long'),
  type: z.enum(SERVICE_TYPES, 'Type must be http or tcp'),
  target: z.string().trim().min(1, 'Target is required').max(500, 'Target is too long'),
  intervalSec: z
    .number('Interval must be a number')
    .int('Interval must be whole seconds')
    .min(30, 'Interval must be at least 30 seconds')
    .max(3600, 'Interval must be at most 3600 seconds'),
  timeoutMs: z
    .number('Timeout must be a number')
    .int('Timeout must be whole milliseconds')
    .min(1000, 'Timeout must be at least 1000 ms')
    .max(30000, 'Timeout must be at most 30000 ms'),
  enabled: z.boolean(),
};

// When both type and target are present, the target must match the type.
function checkTarget(value, ctx) {
  if (value.type === undefined || value.target === undefined) {
    return;
  }
  const message = targetError(value.type, value.target);
  if (message) {
    ctx.addIssue({ code: 'custom', path: ['target'], message });
  }
}

export const serviceCreateSchema = z
  .object({
    name: fields.name,
    type: fields.type,
    target: fields.target,
    intervalSec: fields.intervalSec.optional(),
    timeoutMs: fields.timeoutMs.optional(),
    enabled: fields.enabled.optional(),
  })
  .superRefine(checkTarget);

// A target alone is checked against the saved type in the service layer.
export const serviceUpdateSchema = z
  .object({
    name: fields.name.optional(),
    type: fields.type.optional(),
    target: fields.target.optional(),
    intervalSec: fields.intervalSec.optional(),
    timeoutMs: fields.timeoutMs.optional(),
    enabled: fields.enabled.optional(),
  })
  .superRefine((value, ctx) => {
    if (Object.values(value).every((field) => field === undefined)) {
      ctx.addIssue({ code: 'custom', message: 'Nothing to update' });
      return;
    }
    if (value.type !== undefined && value.target === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['target'],
        message: 'Enter a target for the new type',
      });
      return;
    }
    checkTarget(value, ctx);
  });

export const serviceChecksQuerySchema = z.object({
  range: z.enum(Object.keys(CHECK_RANGES)).default('24h'),
});
