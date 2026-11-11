import { AUTH_COOKIE_NAME } from '../config/authCookie.js';
import { User } from '../models/User.js';
import { verifyAuthToken } from '../services/authService.js';
import { HttpError } from '../utils/httpError.js';

export async function requireAuth(req, res, next) {
  const payload = verifyAuthToken(req.cookies?.[AUTH_COOKIE_NAME]);
  if (!payload) {
    throw new HttpError(401, 'Not authenticated');
  }

  // Load the user on every request so deleted users or role changes apply immediately.
  const user = await User.findById(payload.sub);
  if (!user) {
    throw new HttpError(401, 'Not authenticated');
  }

  req.user = user;
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      throw new HttpError(403, 'You do not have permission to do this');
    }
    next();
  };
}
