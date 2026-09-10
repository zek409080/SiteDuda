import rateLimit from 'express-rate-limit';
import { isProduction } from '../config/env.js';

/*
 * Limites por IP.
 *
 * Importante: sozinho, um limite por IP nunca segura forca bruta, porque
 * atras de um proxy o IP vem de um cabecalho que o cliente consegue forjar.
 * Por isso a defesa principal contra adivinhacao do PIN e o bloqueio gravado
 * no banco (auth.service.js), que vale para o sistema todo e nao depende de
 * IP nenhum. O que esta aqui e a camada de cima, contra volume de trafego.
 */

const base = {
  standardHeaders: true,
  legacyHeaders: false,
  // Sem proxy configurado em desenvolvimento, a checagem embutida da
  // biblioteca acusaria falso positivo; em producao o app confia no proxy.
  validate: { trustProxy: isProduction, xForwardedForHeader: isProduction },
};

/// Tentativas de login: poucas por janela.
export const loginLimiter = rateLimit({
  ...base,
  windowMs: 10 * 60 * 1000,
  limit: 20,
  message: { error: 'Muitas tentativas. Aguarde alguns minutos.' },
});

/// Limite geral da API, para nenhum endpoint ficar aberto a volume ilimitado.
/// Folgado o suficiente para o uso normal da agenda, que faz poucas chamadas
/// por tela, e apertado o suficiente para barrar varredura automatizada.
export const apiLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: 300,
  message: { error: 'Muitas requisições. Aguarde um instante.' },
});
