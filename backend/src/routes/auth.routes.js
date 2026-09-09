import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../middlewares/validate.js';
import { requireAuth } from '../middlewares/auth.js';
import { pinSchema } from './schemas.js';
import {
  SESSION_COOKIE,
  cookieOptions,
  issueToken,
  verifyPin,
} from '../services/auth.service.js';
import { getSettings, publicSettings } from '../services/settings.service.js';

const router = Router();

// Segura tentativas repetidas de adivinhar o PIN.
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Aguarde alguns minutos.' },
});

router.post('/login', loginLimiter, validate(pinSchema), async (req, res, next) => {
  try {
    const ok = await verifyPin(req.body.pin);
    if (!ok) return res.status(401).json({ error: 'PIN incorreto' });

    res.cookie(SESSION_COOKIE, issueToken(), cookieOptions());
    const settings = await getSettings();
    res.json({ ok: true, settings: publicSettings(settings) });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE, { ...cookieOptions(), maxAge: undefined });
  res.json({ ok: true });
});

/// Usado pelo frontend ao abrir o site, para saber se ja existe sessao.
router.get('/session', requireAuth, async (req, res, next) => {
  try {
    const settings = await getSettings();
    res.json({ ok: true, settings: publicSettings(settings) });
  } catch (err) {
    next(err);
  }
});

export default router;
