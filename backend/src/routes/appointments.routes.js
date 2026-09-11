import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import {
  appointmentCreateSchema,
  appointmentDeleteQuery,
  appointmentQuerySchema,
  appointmentUpdateSchema,
  idParam,
  summaryQuerySchema,
} from './schemas.js';
import {
  createAppointment,
  deleteAppointment,
  getAppointment,
  getSummary,
  listAppointments,
  updateAppointment,
} from '../services/appointments.service.js';

const router = Router();

router.get('/', validate(appointmentQuerySchema, 'query'), async (req, res, next) => {
  try {
    res.json(await listAppointments(req.query));
  } catch (err) {
    next(err);
  }
});

/// Resumo discreto da pagina inicial (hoje / proximo / semana).
router.get('/summary', validate(summaryQuerySchema, 'query'), async (req, res, next) => {
  try {
    res.json(await getSummary(req.query));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', validate(idParam, 'params'), async (req, res, next) => {
  try {
    res.json(await getAppointment(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.post('/', validate(appointmentCreateSchema), async (req, res, next) => {
  try {
    res.status(201).json(await createAppointment(req.body));
  } catch (err) {
    next(err);
  }
});

router.put(
  '/:id',
  validate(idParam, 'params'),
  validate(appointmentUpdateSchema),
  async (req, res, next) => {
    try {
      res.json(await updateAppointment(req.params.id, req.body));
    } catch (err) {
      next(err);
    }
  },
);

/// `?scope=` diz o alcance da exclusao dentro de uma serie:
/// one (padrao) = so este; following = este e os proximos; series = todos.
router.delete(
  '/:id',
  validate(idParam, 'params'),
  validate(appointmentDeleteQuery, 'query'),
  async (req, res, next) => {
    try {
      res.json(await deleteAppointment(req.params.id, req.query.scope ?? 'one'));
    } catch (err) {
      next(err);
    }
  },
);

export default router;
