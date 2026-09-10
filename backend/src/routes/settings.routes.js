import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { settingsSchema } from './schemas.js';
import { getSettings, publicSettings, updateSettings } from '../services/settings.service.js';
import { SESSION_COOKIE, cookieOptions, issueToken } from '../services/auth.service.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(publicSettings(await getSettings()));
  } catch (err) {
    next(err);
  }
});

router.put('/', validate(settingsSchema), async (req, res, next) => {
  try {
    const updated = await updateSettings(req.body);

    // Trocar o PIN invalida todas as sessoes. Quem esta fazendo a troca
    // recebe um cookie novo aqui e continua conectada; os outros aparelhos
    // que estivessem logados caem.
    if (req.body.newPin) {
      res.cookie(SESSION_COOKIE, await issueToken(), cookieOptions(req));
    }

    res.json(publicSettings(updated));
  } catch (err) {
    next(err);
  }
});

export default router;
