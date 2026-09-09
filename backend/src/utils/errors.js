/// Erro com codigo HTTP, usado pelas services para falar com o handler de erro.
export class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const notFound = (msg = 'Registro não encontrado') => new AppError(404, msg);
export const badRequest = (msg, details) => new AppError(400, msg, details);
export const conflict = (msg) => new AppError(409, msg);
export const unauthorized = (msg = 'Não autenticado') => new AppError(401, msg);
