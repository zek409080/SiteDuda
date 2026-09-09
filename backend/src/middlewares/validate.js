import { badRequest } from '../utils/errors.js';

/// Valida body/params/query com um schema zod antes de chegar na rota.
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        campo: i.path.join('.') || source,
        mensagem: i.message,
      }));
      return next(badRequest('Dados inválidos', details));
    }
    req[source] = result.data;
    next();
  };
}
