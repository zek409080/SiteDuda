import { AppError } from '../utils/errors.js';
import { isProduction } from '../config/env.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Rota não encontrada' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }

  // Violacao de chave estrangeira / registro ausente vindos do Prisma.
  if (err?.code === 'P2025') return res.status(404).json({ error: 'Registro não encontrado' });
  if (err?.code === 'P2003') return res.status(400).json({ error: 'Paciente informado não existe' });

  console.error('[erro nao tratado]', err);
  res.status(500).json({
    error: 'Erro interno do servidor',
    details: isProduction ? undefined : err?.message,
  });
}
