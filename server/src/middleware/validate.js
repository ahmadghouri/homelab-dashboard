import mongoose from 'mongoose';
import { z } from 'zod';
import { HttpError } from '../utils/httpError.js';

function parseOrThrow(schema, value) {
  const result = schema.safeParse(value ?? {});
  if (!result.success) {
    throw new HttpError(400, 'Invalid request', z.flattenError(result.error).fieldErrors);
  }
  return result.data;
}

// Validates and replaces req.body with the parsed (trimmed, normalized) value.
export function validateBody(schema) {
  return (req, res, next) => {
    req.body = parseOrThrow(schema, req.body);
    next();
  };
}

// req.query is read-only in Express 5, so the parsed value goes to req.validatedQuery.
export function validateQuery(schema) {
  return (req, res, next) => {
    req.validatedQuery = parseOrThrow(schema, req.query);
    next();
  };
}

// Rejects malformed MongoDB ids before they reach the database.
export function validateObjectId(paramName = 'id') {
  return (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params[paramName])) {
      throw new HttpError(400, `Invalid ${paramName}`);
    }
    next();
  };
}
