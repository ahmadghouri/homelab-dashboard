import { z } from 'zod';

export const dnsProtectionSchema = z.object({
  enabled: z.boolean({ error: 'enabled must be true or false' }),
});
