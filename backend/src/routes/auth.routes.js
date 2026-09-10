import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { requireAuth } from '../middlewares/auth.js';
import { loginLimiter } from '../middlewares/rateLimit.js';
import { pinSchema } from './schemas.js';
import {
  SESSION_COOKIE,
  cookieOptions,
  issueToken,
  lockRemainingSeconds,
  revokeAllSessions,
  verifyPin,
} from '../services/auth.service.js';
import { getSettings, publicSettings } from '../services/settings.service.js';

const router = Router();

function formatWait(seconds) {
  const minutes = Math.ceil(seconds / 60);
  return minutes <= 1 ? 'um minuto' : `${minutes} minutos`;
}

router.post('/login', loginLimiter, validate(pinSchema), async (req, res, next) => {
  try {
    // Bloqueio por tentativas erradas. Fica no banco e vale para o sistema
    // inteiro, entao trocar de IP nao contorna e reiniciar o servidor nao zera.
    const waiting = await lockRemainingSeconds();
    if (waiting > 0) {
      return res.status(429).json({
        error: `Muitas tentativas erradas. Tente novamente em ${formatWait(waiting)}.`,
      });
    }

    const ok = await verifyPin(req.body.pin);
    if (!ok) {
      const nowWaiting = await lockRemainingSeconds();
      if (nowWaiting > 0) {
        return res.status(429).json({
          error: `Muitas tentativas erradas. Tente novamente em ${formatWait(nowWaiting)}.`,
        });
      }
      return res.status(401).json({ error: 'PIN incorreto' });
    }

    res.cookie(SESSION_COOKIE, await issueToken(), cookieOptions(req));
    const settings = await getSettings();
    res.json({ ok: true, settings: publicSettings(settings) });
  } catch (err) {
    next(err);
  }
});

/// Sair invalida o token de verdade, e nao apenas apaga o cookie do navegador.
router.post('/logout', async (req, res, next) => {
  try {
    await revokeAllSessions();
    res.clearCookie(SESSION_COOKIE, { ...cookieOptions(req), maxAge: undefined });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
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
