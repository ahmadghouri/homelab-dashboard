import { z } from 'zod';
import { ROUTER_PRIORITIES } from '../models/RouterDeviceSetting.js';

export const routerPrioritySchema = z.object({
  priority: z.enum(ROUTER_PRIORITIES, { error: 'Priority must be high, normal or low' }),
  maxMbps: z
    .number({ error: 'Max speed must be a number' })
    .int('Max speed must be a whole number')
    .min(1, 'Max speed must be at least 1 Mbps')
    .max(10000, 'Max speed must be at most 10000 Mbps')
    .nullable()
    .optional(),
});
