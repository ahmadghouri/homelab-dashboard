import { AUTH_COOKIE_NAME, authCookieOptions, authCookieSetOptions } from '../config/authCookie.js';
import { signAuthToken, verifyCredentials } from '../services/authService.js';
import { changePassword } from '../services/userService.js';

export async function login(req, res) {
  const user = await verifyCredentials(req.body.email, req.body.password);
  res.cookie(AUTH_COOKIE_NAME, signAuthToken(user), authCookieSetOptions);
  res.json({ user });
}

export function logout(req, res) {
  res.clearCookie(AUTH_COOKIE_NAME, authCookieOptions);
  res.status(204).end();
}

// Other sessions are signed out; this one gets a fresh token so the user stays logged in.
export async function postChangePassword(req, res) {
  const user = await changePassword(req.user.id, req.body);
  res.cookie(AUTH_COOKIE_NAME, signAuthToken(user), authCookieSetOptions);
  res.json({ user });
}

export function getMe(req, res) {
  res.json({ user: req.user });
}
