import { z } from 'zod';
import { WORKSPACE_ACTION_TARGETS, WORKSPACE_ACTIONS } from '../models/WorkspaceActionLog.js';

export const MAX_WORKSPACE_OUTPUT_LENGTH = 500;
const MAX_LOG_LINE_LENGTH = 2000;

// Project and service ids come from workspace.json, container ids are short Docker ids.
const targetIdSchema = z
  .string({ error: 'Id is required' })
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/, 'Invalid id');

// ---------- REST input ----------

export const workspaceActionSchema = z.object({
  target: z.enum(WORKSPACE_ACTION_TARGETS, { error: 'Unknown target' }),
  id: targetIdSchema,
  action: z.enum(WORKSPACE_ACTIONS, { error: 'Unknown action' }),
});

export const workspaceActionListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const workspaceLogsQuerySchema = z.object({
  target: z.enum(['project', 'container'], { error: 'Unknown target' }),
  id: targetIdSchema,
  lines: z.coerce.number().int().min(1).max(500).default(200),
});

// ---------- Agent input (another machine, so validated like a request body) ----------

const text = (max) => z.string().max(max);
const nullableText = (max) => z.string().max(max).nullable();
const isoDate = z.iso.datetime({ offset: true });
const port = z.number().int().min(0).max(65535);
const pid = z.number().int().min(0);

const projectSchema = z.object({
  id: text(64),
  name: text(200),
  type: z.enum(['node', 'laravel', 'python', 'other']),
  port: port.nullable(),
  status: z.enum(['running', 'stopped', 'crashed', 'external']),
  pid: pid.nullable(),
  startedAt: isoDate.nullable(),
  exitCode: z.number().int().nullable(),
  restarts: z.number().int().min(0),
  errorCount: z.number().int().min(0),
  hasLogFile: z.boolean(),
});

const containerSchema = z.object({
  id: text(64),
  name: text(200),
  image: text(300),
  state: text(50),
  status: text(200),
  ports: text(1000),
});

const serviceSchema = z.object({
  id: text(64),
  name: text(200),
  serviceName: text(200),
  port: port.nullable(),
  status: z.enum(['running', 'stopped', 'not_found', 'unknown']),
});

const listeningPortSchema = z.object({
  port,
  address: text(100),
  pid: pid.nullable(),
  process: nullableText(200),
  conflict: z.boolean(),
  expectedBy: nullableText(64),
});

export const agentWorkspaceSnapshotSchema = z.object({
  at: isoDate,
  controlEnabled: z.boolean(),
  configFound: z.boolean(),
  configError: nullableText(1000),
  projects: z.array(projectSchema).max(100),
  containers: z.object({
    available: z.boolean(),
    error: nullableText(1000),
    items: z.array(containerSchema).max(300),
  }),
  services: z.array(serviceSchema).max(100),
  ports: z.array(listeningPortSchema).max(300),
});

// Long output is cut instead of rejected, so a chatty command still counts as a reply.
const outputSchema = z
  .string()
  .transform((value) => value.slice(0, MAX_WORKSPACE_OUTPUT_LENGTH));

export const agentWorkspaceActionReplySchema = z.object({
  ok: z.boolean(),
  output: outputSchema,
});

export const agentWorkspaceLogsReplySchema = z.object({
  ok: z.boolean(),
  output: outputSchema.optional().default(''),
  lines: z
    .array(
      z.object({
        ts: isoDate.nullable(),
        stream: z.enum(['stdout', 'stderr', 'file']),
        text: z.string().transform((value) => value.slice(0, MAX_LOG_LINE_LENGTH)),
      }),
    )
    .max(500)
    .default([]),
});
