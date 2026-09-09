import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { clientSchema, clientQuerySchema, idParam } from './schemas.js';
import {
  createClient,
  deleteClient,
  getClient,
  listClientAppointments,
  listClients,
  updateClient,
} from '../services/clients.service.js';

const router = Router();

router.get('/', validate(clientQuerySchema, 'query'), async (req, res, next) => {
  try {
    res.json(await listClients(req.query));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', validate(idParam, 'params'), async (req, res, next) => {
  try {
    res.json(await getClient(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.get('/:id/appointments', validate(idParam, 'params'), async (req, res, next) => {
  try {
    res.json(await listClientAppointments(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.post('/', validate(clientSchema), async (req, res, next) => {
  try {
    res.status(201).json(await createClient(req.body));
  } catch (err) {
    next(err);
  }
});

router.put('/:id', validate(idParam, 'params'), validate(clientSchema), async (req, res, next) => {
  try {
    res.json(await updateClient(req.params.id, req.body));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', validate(idParam, 'params'), async (req, res, next) => {
  try {
    await deleteClient(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
