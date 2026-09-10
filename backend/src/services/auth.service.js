import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env, isProduction } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { getSettings } from './settings.service.js';
import { unauthorized } from '../utils/errors.js';

export const SESSION_COOKIE = 'agenda_session';

const SETTINGS_ID = 1;

/// Degraus de bloqueio depois de N erros seguidos de PIN.
/// A escada cresce devagar no comeco (um erro de digitacao nao atrapalha)
/// e fica dura o suficiente para tornar a forca bruta inviavel.
const LOCK_STEPS = [
  { attempts: 15, minutes: 60 },
  { attempts: 10, minutes: 15 },
  { attempts: 5, minutes: 1 },
];

export function hashPin(pin) {
  return bcrypt.hash(String(pin), 10);
}

function lockMinutesFor(attempts) {
  return LOCK_STEPS.find((step) => attempts >= step.attempts)?.minutes ?? 0;
}

/// Quanto tempo falta do bloqueio, em segundos (0 = liberado).
export async function lockRemainingSeconds() {
  const settings = await getSettings();
  if (!settings.lockedUntil) return 0;
  const remaining = Math.ceil((settings.lockedUntil.getTime() - Date.now()) / 1000);
  return remaining > 0 ? remaining : 0;
}

/// Confere o PIN e mantem o contador de tentativas no banco.
/// O bloqueio e global (o sistema tem uma unica usuaria), entao nao depende
/// do IP de origem — que e justamente o dado que um atacante consegue forjar.
export async function verifyPin(pin) {
  const settings = await getSettings();
  const ok = await bcrypt.compare(String(pin), settings.accessPin);

  if (ok) {
    // Acertou: zera o contador e libera.
    if (settings.failedAttempts !== 0 || settings.lockedUntil) {
      await prisma.settings.update({
        where: { id: SETTINGS_ID },
        data: { failedAttempts: 0, lockedUntil: null },
      });
    }
    return true;
  }

  const attempts = settings.failedAttempts + 1;
  const minutes = lockMinutesFor(attempts);

  await prisma.settings.update({
    where: { id: SETTINGS_ID },
    data: {
      failedAttempts: attempts,
      lockedUntil: minutes > 0 ? new Date(Date.now() + minutes * 60 * 1000) : null,
    },
  });

  return false;
}

/// O token carrega a geracao da sessao, conferida a cada requisicao.
export async function issueToken() {
  const settings = await getSettings();
  return jwt.sign({ role: 'owner', v: settings.sessionVersion }, env.sessionSecret, {
    expiresIn: `${env.sessionMaxAgeDays}d`,
  });
}

/// Valida assinatura, prazo e geracao. Um token de uma geracao antiga e
/// recusado mesmo estando dentro do prazo e com assinatura valida.
export async function readToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, env.sessionSecret);
  } catch {
    throw unauthorized('Sessão expirada ou inválida');
  }

  const settings = await getSettings();
  if (payload.v !== settings.sessionVersion) {
    throw unauthorized('Sessão encerrada. Entre novamente.');
  }

  return payload;
}

/// Invalida todas as sessoes existentes.
export async function revokeAllSessions() {
  await getSettings();
  await prisma.settings.update({
    where: { id: SETTINGS_ID },
    data: { sessionVersion: { increment: 1 } },
  });
}

/// Opcoes do cookie de sessao.
/// A flag `secure` segue o protocolo real da requisicao (`req.secure`, que
/// considera o X-Forwarded-Proto do proxy). Assim o cookie ganha `Secure`
/// automaticamente sob HTTPS e continua funcionando em http://localhost —
/// sem depender de ninguem lembrar de configurar NODE_ENV na hospedagem.
export function cookieOptions(req) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: req?.secure ?? isProduction,
    maxAge: env.sessionMaxAgeDays * 24 * 60 * 60 * 1000,
    path: '/',
  };
}
