import { env } from '../config/env.js';

// Central error handler. Never leak stack traces or internal details in production.
// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, next) {
  const status = Number.isInteger(error.status) ? error.status : 500;

  if (status >= 500) {
    console.error('[error]', error);
  }

  const message = status >= 500 && env.isProduction ? 'Internal server error' : error.message;

  res.status(status).json({
    message,
    ...(error.details ? { details: error.details } : {}),
  });
}
