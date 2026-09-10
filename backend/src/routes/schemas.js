import { z } from 'zod';
import { DATE_RE, TIME_RE } from '../utils/time.js';

const trimmed = (max) => z.string().trim().max(max);
const dateString = z.string().regex(DATE_RE, 'Use o formato AAAA-MM-DD');
const timeString = z.string().regex(TIME_RE, 'Use o formato HH:MM');
const optionalText = (max) =>
  z.union([z.string().trim().max(max), z.literal(''), z.null()]).optional();

export const idParam = z.object({ id: z.string().uuid('Identificador inválido') });

/// PIN minimo aceito ao DEFINIR um novo. O login continua aceitando 4
/// digitos para nao trancar quem ja tinha um PIN curto cadastrado antes
/// desta regra — a forca bruta e contida pelo bloqueio por tentativas.
export const MIN_NEW_PIN = 6;

export const pinSchema = z.object({
  pin: z.string().min(4, 'O PIN precisa ter ao menos 4 dígitos').max(20),
});

export const clientSchema = z.object({
  name: trimmed(120).min(2, 'Informe o nome completo'),
  phone: trimmed(30).min(8, 'Informe um telefone válido'),
  email: z.union([z.string().trim().email('E-mail inválido').max(160), z.literal(''), z.null()]).optional(),
  birthDate: z.union([dateString, z.literal(''), z.null()]).optional(),
  notes: optionalText(4000),
});

export const clientQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
});

const statusEnum = z.enum(['AGENDADO', 'CONFIRMADO', 'REALIZADO', 'CANCELADO', 'FALTOU']);

export const appointmentCreateSchema = z
  .object({
    clientId: z.string().uuid('Selecione um cliente'),
    date: dateString,
    startTime: timeString,
    endTime: timeString.optional(),
    duration: z.coerce.number().int().min(5).max(480).optional(),
    status: statusEnum.optional(),
    type: trimmed(60).optional(),
    notes: optionalText(8000),
  })
  .refine((data) => data.endTime || data.duration, {
    message: 'Informe a duração ou o horário final',
    path: ['duration'],
  });

export const appointmentUpdateSchema = z.object({
  clientId: z.string().uuid().optional(),
  date: dateString.optional(),
  startTime: timeString.optional(),
  endTime: timeString.optional(),
  duration: z.coerce.number().int().min(5).max(480).optional(),
  status: statusEnum.optional(),
  type: trimmed(60).optional(),
  notes: optionalText(8000),
});

export const appointmentQuerySchema = z.object({
  from: dateString.optional(),
  to: dateString.optional(),
  clientId: z.string().uuid().optional(),
});

export const summaryQuerySchema = z.object({
  today: dateString,
  weekStart: dateString,
  weekEnd: dateString,
});

export const settingsSchema = z.object({
  professionalName: trimmed(120).min(2, 'Informe o nome'),
  workStart: timeString,
  workEnd: timeString,
  defaultDuration: z.coerce.number().int().min(10).max(480),
  workDays: z.array(z.coerce.number().int().min(0).max(6)).min(1, 'Escolha ao menos um dia'),
  newPin: z
    .union([
      z
        .string()
        .trim()
        .min(MIN_NEW_PIN, `O novo PIN precisa ter ao menos ${MIN_NEW_PIN} dígitos`)
        .max(20),
      z.literal(''),
    ])
    .optional(),
});
