import { rateLimit } from 'express-rate-limit';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

// Counts only failed logins, so a correct password is never blocked by earlier typos.
export const loginLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES_MS,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ message: 'Too many failed login attempts. Try again in 15 minutes.' });
  },
});
