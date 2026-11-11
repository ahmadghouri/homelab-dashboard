import { z } from 'zod';
import { SPEED_TEST_RANGES } from '../services/internetService.js';
import { currentMonth } from '../services/ispReportService.js';
import { QUALITY_RANGES } from '../services/qualityService.js';

export const speedTestsQuerySchema = z.object({
  range: z.enum(Object.keys(SPEED_TEST_RANGES)).default('7d'),
});

export const outagesQuerySchema = z.object({
  limit: z.coerce
    .number({ error: 'Limit must be a number' })
    .int('Limit must be a whole number')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit must be at most 100')
    .default(20),
});

export const qualityQuerySchema = z.object({
  range: z.enum(Object.keys(QUALITY_RANGES), { error: 'Range must be 1h, 24h or 7d' }).default('24h'),
});

// "YYYY-MM", from 2000 up to the current month. Defaults to the current month.
export const ispReportQuerySchema = z.object({
  month: z
    .string({ error: 'Month must be text like 2026-01' })
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: 'Month must look like 2026-01', abort: true })
    .refine((month) => month >= '2000-01', 'Month must be 2000-01 or later')
    .refine((month) => month <= currentMonth(), 'Month cannot be in the future')
    .default(() => currentMonth()),
});
