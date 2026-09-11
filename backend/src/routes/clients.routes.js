import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { clientSchema, clientQuerySchema, idParam } from './schemas.js';
import { createDocumentRouter } from './documents.routes.js';
import { clientDocuments } from '../services/documents.service.js';
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

/* ------------------------------ documentos ------------------------------
 * Aninhadas sob /api/clients, que ja passa pelo requireAuth. A mecanica de
 * enviar, abrir e apagar e a mesma das notas e mora em documents.routes.js.
 * ----------------------------------------------------------------------- */

router.use('/:id/documents', validate(idParam, 'params'), createDocumentRouter(clientDocuments));

export default router;
