import { z } from 'zod';
import {
  MULTILINK_CAP_GB_LIMITS,
  MULTILINK_MAX_LINES,
  MULTILINK_MODES,
  MULTILINK_ROLES,
} from '../models/MultiLinkSetting.js';

export const MAX_MULTILINK_OUTPUT_LENGTH = 500;

// Line ids are interface names such as "Wi-Fi" or "Ethernet 2": any text without control characters.
export const lineIdSchema = z
  .string({ error: 'Line id is required' })
  .regex(/^\P{Cc}{1,64}$/u, 'Invalid line id');

// ---------- REST input ----------

const lineSettingSchema = z.object({
  role: z.enum(MULTILINK_ROLES, { error: 'Unknown role' }),
  capGb: z
    .number({ error: 'Cap must be a number' })
    .min(MULTILINK_CAP_GB_LIMITS.min, `Cap must be at least ${MULTILINK_CAP_GB_LIMITS.min} GB`)
    .max(MULTILINK_CAP_GB_LIMITS.max, `Cap must be at most ${MULTILINK_CAP_GB_LIMITS.max} GB`)
    .nullable()
    .default(null),
});

export const multiLinkSettingsSchema = z.object({
  mode: z.enum(MULTILINK_MODES, { error: 'Unknown mode' }),
  sticky: z.boolean({ error: 'Sticky must be true or false' }),
  lines: z
    .record(lineIdSchema, lineSettingSchema)
    .default({})
    .refine((lines) => Object.keys(lines).length <= MULTILINK_MAX_LINES, {
      error: `At most ${MULTILINK_MAX_LINES} lines`,
    }),
});

// ---------- Agent input (another machine, so validated like a request body) ----------

const isoDate = z.iso.datetime({ offset: true });
const port = z.number().int().min(0).max(65535);
const count = z.number().int().min(0);
const rate = z.number().min(0);

const lineSchema = z.object({
  id: lineIdSchema,
  name: z.string().max(200),
  kind: z.enum(['wifi', 'ethernet', 'tethering', 'other']),
  ip: z.string().max(64),
  up: z.boolean(),
  latencyMs: z.number().min(0).nullable(),
  lossPct: z.number().min(0).max(100).nullable(),
  role: z.enum(MULTILINK_ROLES),
  capBytes: z.number().min(0).nullable(),
  usedBytes: z.number().min(0),
  rxBps: rate,
  txBps: rate,
  connections: count,
  lastSpeedTest: z
    .object({ at: isoDate, downloadMbps: z.number().min(0).nullable(), ok: z.boolean() })
    .nullable(),
});

export const agentMultiLinkSnapshotSchema = z.object({
  at: isoDate,
  enabled: z.boolean(),
  proxy: z.object({
    listening: z.boolean(),
    httpPort: port,
    socksPort: port,
    error: z.string().max(500).nullable(),
  }),
  mode: z.enum(MULTILINK_MODES),
  sticky: z.boolean(),
  lines: z.array(lineSchema).max(MULTILINK_MAX_LINES),
  totals: z.object({ rxBps: rate, txBps: rate, connections: count }),
});

// Long output is cut instead of rejected, so a chatty agent still counts as a reply.
const outputSchema = z
  .string()
  .transform((value) => value.slice(0, MAX_MULTILINK_OUTPUT_LENGTH));

export const agentMultiLinkReplySchema = z.object({
  ok: z.boolean(),
  output: outputSchema.optional().default(''),
});

export const agentMultiLinkSpeedTestReplySchema = agentMultiLinkReplySchema.extend({
  downloadMbps: z.number().min(0).nullable().optional().default(null),
});
