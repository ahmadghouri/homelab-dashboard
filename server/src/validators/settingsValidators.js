import { z } from 'zod';
import { SCAN_INTERVAL_LIMITS, SPEED_TEST_INTERVAL_LIMITS } from '../models/Settings.js';

// Telegram chat IDs are numbers (negative for groups) or @channel names.
const chatId = z
  .string()
  .trim()
  .max(64)
  .regex(/^(-?\d+|@[A-Za-z0-9_]{5,})?$/, 'Use a numeric chat ID or @channelname');

const intervalIn = ({ min, max }) => z.number().int().min(min).max(max);

export const settingsUpdateSchema = z
  .object({
    telegram: z.object({ enabled: z.boolean().optional(), chatId: chatId.optional() }).optional(),
    network: z.object({ scanIntervalMin: intervalIn(SCAN_INTERVAL_LIMITS).optional() }).optional(),
    internet: z
      .object({ speedTestIntervalMin: intervalIn(SPEED_TEST_INTERVAL_LIMITS).optional() })
      .optional(),
  })
  .refine((value) => value.telegram || value.network || value.internet, {
    message: 'Nothing to update',
  });
