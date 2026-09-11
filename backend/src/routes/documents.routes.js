import { Router } from 'express';
import multer from 'multer';
import { validate } from '../middlewares/validate.js';
import { documentParams } from './schemas.js';
import { badRequest } from '../utils/errors.js';
import { MAX_FILE_BYTES, isInlineType, uploadSingleDocument } from '../lib/storage.js';

const megabytes = (bytes) => Math.round(bytes / (1024 * 1024));

/// Traduz as falhas do multer para mensagens que a profissional entende,
/// em vez de deixar vazar o erro tecnico da biblioteca.
function receiveFile(req, res, next) {
  uploadSingleDocument(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(badRequest(`Arquivo muito grande. O limite é ${megabytes(MAX_FILE_BYTES)} MB.`));
      }
      return next(badRequest('Não foi possível receber o arquivo. Tente novamente.'));
    }
    if (err) return next(err);
    if (!req.file) return next(badRequest('Selecione um arquivo para enviar'));
    next();
  });
}

/// Monta o cabecalho com o nome original preservado. A versao entre aspas
/// so aceita ASCII simples; a versao `filename*` carrega acentos e cedilha
/// para os navegadores atuais.
function contentDisposition(inline, name) {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(name);
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

/**
 * Rotas de anexo para um dono qualquer (paciente ou nota).
 *
 * Monta-se sob `/:id/documents` do roteador pai, que ja passou pelo
 * requireAuth — nao existe caminho publico para os arquivos. O `mergeParams`
 * e o que deixa o id do dono visivel aqui dentro.
 */
export function createDocumentRouter(service) {
  const router = Router({ mergeParams: true });

  router.get('/', async (req, res, next) => {
    try {
      res.json(await service.list(req.params.id));
    } catch (err) {
      next(err);
    }
  });

  router.post('/', receiveFile, async (req, res, next) => {
    try {
      res.status(201).json(await service.create(req.params.id, req.file));
    } catch (err) {
      next(err);
    }
  });

  /// Entrega o arquivo. O tipo enviado no cabecalho sai da nossa lista de
  /// formatos aceitos, nunca do que o navegador declarou no upload.
  router.get('/:documentId/file', validate(documentParams, 'params'), async (req, res, next) => {
    try {
      const { doc, fullPath } = await service.open(req.params.id, req.params.documentId);
      const inline = req.query.download !== '1' && isInlineType(doc.mimeType);

      res.setHeader('Content-Type', doc.mimeType);
      res.setHeader('Content-Disposition', contentDisposition(inline, doc.originalName));
      res.setHeader('X-Content-Type-Options', 'nosniff');
      // Documento de paciente nao fica em cache compartilhado nem em disco.
      res.setHeader('Cache-Control', 'private, no-store');

      /*
       * Politica propria para a resposta do arquivo, no lugar da global.
       *
       * `default-src 'none'` corta script, fetch e qualquer subrecurso — se
       * um dia passar por aqui um formato que execute codigo, ele nao tem
       * para onde correr. A diferenca em relacao a politica global e o
       * `object-src 'self'`: a global usa 'none', e isso pode impedir o
       * visualizador de PDF do navegador de abrir o proprio arquivo.
       */
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; img-src 'self' data:; object-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      );
      res.sendFile(fullPath);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:documentId', validate(documentParams, 'params'), async (req, res, next) => {
    try {
      await service.remove(req.params.id, req.params.documentId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
