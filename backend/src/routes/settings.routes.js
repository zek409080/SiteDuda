import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { settingsSchema } from './schemas.js';
import { getSettings, publicSettings, updateSettings } from '../services/settings.service.js';

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
    res.json(publicSettings(await updateSettings(req.body)));
  } catch (err) {
    next(err);
  }
});

export default router;
