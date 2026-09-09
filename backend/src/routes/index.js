import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import authRoutes from './auth.routes.js';
import clientsRoutes from './clients.routes.js';
import appointmentsRoutes from './appointments.routes.js';
import settingsRoutes from './settings.routes.js';

const router = Router();

router.get('/health', (req, res) => res.json({ ok: true }));

router.use('/auth', authRoutes);

// Tudo daqui para baixo exige sessao valida.
router.use('/clients', requireAuth, clientsRoutes);
router.use('/appointments', requireAuth, appointmentsRoutes);
router.use('/settings', requireAuth, settingsRoutes);

export default router;
