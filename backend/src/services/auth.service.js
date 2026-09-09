import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env, isProduction } from '../config/env.js';
import { getSettings } from './settings.service.js';
import { unauthorized } from '../utils/errors.js';

export const SESSION_COOKIE = 'agenda_session';

export function hashPin(pin) {
  return bcrypt.hash(String(pin), 10);
}

/// Confere o PIN digitado contra o hash guardado nas configuracoes.
export async function verifyPin(pin) {
  const settings = await getSettings();
  return bcrypt.compare(String(pin), settings.accessPin);
}

export function issueToken() {
  return jwt.sign({ role: 'owner' }, env.sessionSecret, {
    expiresIn: `${env.sessionMaxAgeDays}d`,
  });
}

export function readToken(token) {
  try {
    return jwt.verify(token, env.sessionSecret);
  } catch {
    throw unauthorized('Sessão expirada ou inválida');
  }
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction, // exige HTTPS quando publicado
    maxAge: env.sessionMaxAgeDays * 24 * 60 * 60 * 1000,
    path: '/',
  };
}
