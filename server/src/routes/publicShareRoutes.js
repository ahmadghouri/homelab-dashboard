import { rateLimit } from 'express-rate-limit';
import { Router } from 'express';
import { getPublicShareContent, getPublicShareInfo } from '../controllers/shareController.js';
import { SHARE_NOT_AVAILABLE } from '../services/storage/shareService.js';
import { HttpError } from '../utils/httpError.js';
import { shareTokenPattern } from '../validators/storageFileValidators.js';

// Public share links (no login). Rate limited per IP; every failure is the same 404.
export const publicShareRoutes = Router();

function perMinuteLimiter(limit) {
  return rateLimit({
    windowMs: 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({ message: 'Too many requests. Try again in a minute.' });
    },
  });
}

// Looking up links is cheap to abuse, so it stays strict. Video and audio players send many
// small Range requests while seeking, so content gets a higher limit.
const infoLimiter = perMinuteLimiter(60);
const contentLimiter = perMinuteLimiter(600);

function validToken(req, res, next) {
  if (!shareTokenPattern.test(req.params.token)) {
    throw new HttpError(404, SHARE_NOT_AVAILABLE);
  }
  next();
}

publicShareRoutes.get('/shares/:token', infoLimiter, validToken, getPublicShareInfo);
publicShareRoutes.get('/shares/:token/content', contentLimiter, validToken, getPublicShareContent);
