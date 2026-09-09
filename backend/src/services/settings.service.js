import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';

const SETTINGS_ID = 1;

const DEFAULTS = {
  professionalName: 'Minha Agenda',
  workStart: '08:00',
  workEnd: '18:00',
  defaultDuration: 50,
  workDays: [1, 2, 3, 4, 5],
};

/// Le a linha unica de configuracao, criando-a na primeira execucao
/// com o PIN inicial vindo da variavel de ambiente.
export async function getSettings() {
  const existing = await prisma.settings.findUnique({ where: { id: SETTINGS_ID } });
  if (existing) return existing;

  return prisma.settings.create({
    data: {
      id: SETTINGS_ID,
      ...DEFAULTS,
      accessPin: await bcrypt.hash(String(env.initialPin), 10),
    },
  });
}

/// Versao segura para enviar ao frontend: sem o hash do PIN.
export function publicSettings(settings) {
  const { accessPin, createdAt, updatedAt, ...rest } = settings;
  return rest;
}

export async function updateSettings(input) {
  await getSettings(); // garante que a linha existe

  const data = {
    professionalName: input.professionalName,
    workStart: input.workStart,
    workEnd: input.workEnd,
    defaultDuration: input.defaultDuration,
    workDays: input.workDays,
  };

  if (input.newPin) {
    data.accessPin = await bcrypt.hash(String(input.newPin), 10);
  }

  return prisma.settings.update({ where: { id: SETTINGS_ID }, data });
}
