import { SESSION_COOKIE, readToken } from '../services/auth.service.js';
import { unauthorized } from '../utils/errors.js';

/// Barra qualquer requisicao sem sessao valida.
/// Toda rota de dados passa por aqui — a API nunca responde sem autenticacao.
/// Alem da assinatura e do prazo, confere a geracao da sessao, para que
/// sair do sistema ou trocar o PIN derrube os cookies ja emitidos.
export async function requireAuth(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return next(unauthorized());
  try {
    req.session = await readToken(token);
    next();
  } catch (err) {
    next(err);
  }
}
