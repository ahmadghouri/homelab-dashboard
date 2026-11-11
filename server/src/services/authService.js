import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { HttpError } from '../utils/httpError.js';

const BCRYPT_COST = 12;
const INVALID_LOGIN_MESSAGE = 'Invalid email or password';

// Compared against when the email does not exist, so both cases take the same time.
const DUMMY_HASH = bcrypt.hashSync('timing-safe-dummy-password', BCRYPT_COST);

export function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyCredentials(email, password) {
  const user = await User.findOne({ email }).select('+passwordHash');
  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !passwordMatches) {
    throw new HttpError(401, INVALID_LOGIN_MESSAGE);
  }

  user.lastLoginAt = new Date();
  await user.save();
  return user;
}

export function signAuthToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

// Returns the token payload, or null when the token is missing, expired, or invalid.
export function verifyAuthToken(token) {
  if (!token) {
    return null;
  }
  try {
    return jwt.verify(token, env.jwtSecret);
  } catch {
    return null;
  }
}
