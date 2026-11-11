import { z } from 'zod';
import { HISTORY_RANGES } from '../services/metricsService.js';

export const deviceNameSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60, 'Name is too long'),
});

export const metricsQuerySchema = z.object({
  range: z.enum(Object.keys(HISTORY_RANGES)).default('1h'),
});

// Agent payloads come from other machines, so they are validated like any request body.
const percent = z.number().min(0).max(100);
const bytes = z.number().nonnegative();
const shortText = z.string().max(200);

export const agentHelloSchema = z.object({
  hostname: shortText,
  platform: shortText,
  osName: shortText,
  osVersion: shortText,
  arch: shortText,
  cpuModel: shortText,
  cpuCores: z.number().int().positive().max(1024),
  totalMemBytes: bytes,
  agentVersion: shortText,
});

export const agentMetricsSchema = z.object({
  cpu: percent,
  mem: z.object({ usedPct: percent, usedBytes: bytes, totalBytes: bytes }),
  disks: z
    .array(z.object({ mount: shortText, usedPct: percent, sizeBytes: bytes, usedBytes: bytes }))
    .max(32),
  tempC: z.number().min(-50).max(150).nullable(),
  battery: z.object({ percent, charging: z.boolean() }).nullable(),
  net: z.object({ rxBps: bytes, txBps: bytes }),
  uptimeSec: z.number().nonnegative(),
  topProcesses: z
    .array(
      z.object({
        pid: z.number().int().nonnegative(),
        name: shortText,
        cpu: z.number().nonnegative(),
        memBytes: bytes,
      }),
    )
    .max(10),
});
