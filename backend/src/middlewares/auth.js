import { SESSION_COOKIE, readToken } from '../services/auth.service.js';
import { unauthorized } from '../utils/errors.js';

/// Barra qualquer requisicao sem sessao valida.
/// Toda rota de dados passa por aqui — a API nunca responde sem autenticacao.
export function requireAuth(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return next(unauthorized());
  try {
    req.session = readToken(token);
    next();
  } catch (err) {
    next(err);
  }
}
