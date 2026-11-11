import { z } from 'zod';

export const networkDeviceUpdateSchema = z
  .object({
    customName: z.string().trim().max(60, 'Name is too long').optional(),
    trusted: z.boolean().optional(),
  })
  .refine((value) => value.customName !== undefined || value.trusted !== undefined, {
    message: 'Nothing to update',
  });
