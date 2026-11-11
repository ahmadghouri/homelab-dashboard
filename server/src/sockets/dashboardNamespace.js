import { AUTH_COOKIE_NAME } from '../config/authCookie.js';
import { isTokenOlderThanPassword } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { verifyAuthToken } from '../services/authService.js';
import { setDashboardNamespace } from './registry.js';

function readCookie(cookieHeader, name) {
  for (const part of (cookieHeader ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

// Same session cookie as the REST API: only logged-in users get live updates.
async function authenticateDashboard(socket, next) {
  try {
    const payload = verifyAuthToken(readCookie(socket.handshake.headers.cookie, AUTH_COOKIE_NAME));
    const user = payload ? await User.findById(payload.sub).select('+passwordChangedAt') : null;
    if (!user || isTokenOlderThanPassword(payload, user)) {
      next(new Error('Not authenticated'));
      return;
    }
    socket.data.userId = user.id;
    next();
  } catch (error) {
    console.error('[dashboard] auth failed:', error.message);
    next(new Error('Server error'));
  }
}

export function registerDashboardNamespace(io) {
  const namespace = io.of('/dashboard');
  namespace.use(authenticateDashboard);
  setDashboardNamespace(namespace);
}
