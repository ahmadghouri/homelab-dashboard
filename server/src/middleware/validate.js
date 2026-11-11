import { z } from 'zod';
import { HttpError } from '../utils/httpError.js';

// Validates and replaces req.body with the parsed (trimmed, normalized) value.
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      throw new HttpError(400, 'Invalid request', z.flattenError(result.error).fieldErrors);
    }
    req.body = result.data;
    next();
  };
}
