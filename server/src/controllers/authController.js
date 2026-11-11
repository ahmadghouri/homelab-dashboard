import { AUTH_COOKIE_NAME, authCookieOptions, authCookieSetOptions } from '../config/authCookie.js';
import { signAuthToken, verifyCredentials } from '../services/authService.js';

export async function login(req, res) {
  const user = await verifyCredentials(req.body.email, req.body.password);
  res.cookie(AUTH_COOKIE_NAME, signAuthToken(user), authCookieSetOptions);
  res.json({ user });
}

export function logout(req, res) {
  res.clearCookie(AUTH_COOKIE_NAME, authCookieOptions);
  res.status(204).end();
}

export function getMe(req, res) {
  res.json({ user: req.user });
}
