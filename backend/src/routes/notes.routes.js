import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { idParam, noteSchema } from './schemas.js';
import { createDocumentRouter } from './documents.routes.js';
import { noteDocuments } from '../services/documents.service.js';
import { createNote, deleteNote, listNotes, updateNote } from '../services/notes.service.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(await listNotes());
  } catch (err) {
    next(err);
  }
});

router.post('/', validate(noteSchema), async (req, res, next) => {
  try {
    res.status(201).json(await createNote(req.body));
  } catch (err) {
    next(err);
  }
});

router.put('/:id', validate(idParam, 'params'), validate(noteSchema), async (req, res, next) => {
  try {
    res.json(await updateNote(req.params.id, req.body));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', validate(idParam, 'params'), async (req, res, next) => {
  try {
    await deleteNote(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/// Anexos da nota: mesma mecanica dos documentos de paciente.
router.use('/:id/documents', validate(idParam, 'params'), createDocumentRouter(noteDocuments));

export default router;
