import { z } from 'zod';
import { REMOTE_COMMANDS } from '../models/CommandLog.js';

export const MAX_COMMAND_OUTPUT_LENGTH = 500;

export const sendCommandSchema = z.object({
  command: z.enum(REMOTE_COMMANDS, { error: 'Unknown command' }),
});

export const commandListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// The reply comes from another machine, so it is validated like any request body.
// Long output is cut instead of rejected, so a chatty OS command still counts as a reply.
export const agentCommandReplySchema = z.object({
  ok: z.boolean(),
  output: z.string().transform((value) => value.slice(0, MAX_COMMAND_OUTPUT_LENGTH)),
});
