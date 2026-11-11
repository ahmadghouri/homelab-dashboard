import { env } from './env.js';

export const AUTH_COOKIE_NAME = 'homelab_token';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const authCookieOptions = Object.freeze({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'strict',
  path: '/',
});

export const authCookieSetOptions = Object.freeze({
  ...authCookieOptions,
  maxAge: SEVEN_DAYS_MS,
});
