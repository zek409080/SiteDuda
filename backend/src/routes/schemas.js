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

const optionalEmail = z
  .union([z.string().trim().email('E-mail inválido').max(160), z.literal(''), z.null()])
  .optional();

/// Limites de quantidade para que um envio automatizado nao consiga inflar
/// o banco com milhares de linhas presas a um unico paciente.
const boundedList = (item, max) => z.array(item).max(max).optional();

const responsibleSchema = z.object({
  name: trimmed(120).min(2, 'Informe o nome do responsável'),
  relation: trimmed(60).optional(),
  phone: optionalText(30),
  email: optionalEmail,
  notes: optionalText(2000),
});

const allergySchema = z.object({
  name: trimmed(120).min(2, 'Informe a alergia'),
  notes: optionalText(2000),
});

const medicationSchema = z.object({
  name: trimmed(120).min(2, 'Informe o medicamento'),
  dosage: optionalText(60),
  frequency: optionalText(80),
  notes: optionalText(2000),
});

export const clientSchema = z.object({
  name: trimmed(120).min(2, 'Informe o nome completo'),
  phone: trimmed(30).min(8, 'Informe um telefone válido'),
  email: optionalEmail,
  birthDate: z.union([dateString, z.literal(''), z.null()]).optional(),
  address: optionalText(240),
  notes: optionalText(4000),
  hasAllergies: z.coerce.boolean().optional(),
  responsibles: boundedList(responsibleSchema, 10),
  allergies: boundedList(allergySchema, 30),
  medications: boundedList(medicationSchema, 30),
});

/// Rota de documento carrega dois ids: o do paciente e o do arquivo.
/// Os dois sao conferidos juntos no banco, entao trocar um deles na URL
/// nao alcanca o documento de outro paciente.
export const documentParams = z.object({
  id: z.string().uuid('Identificador inválido'),
  documentId: z.string().uuid('Identificador inválido'),
});

export const clientQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
});

const statusEnum = z.enum(['AGENDADO', 'CONFIRMADO', 'REALIZADO', 'CANCELADO', 'FALTOU']);

/// Anotacao livre da profissional. Conteudo pode ficar vazio: as vezes o
/// titulo ja e o lembrete inteiro ("Ligar para Maria").
export const noteSchema = z.object({
  title: trimmed(160).min(2, 'Informe um título para a nota'),
  content: z.union([z.string().trim().max(20000), z.literal(''), z.null()]).optional(),
});

/*
 * Recorrencia.
 *
 * `until` e `count` sao os dois jeitos de dizer onde a serie para, e um
 * deles precisa vir — sem limite o servidor geraria ocorrencias para
 * sempre. Nao e obrigatorio usar os dois.
 */
export const RECURRENCE_MAX = 120;

const frequencyEnum = z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'BIMONTHLY', 'CUSTOM']);

export const recurrenceSchema = z
  .object({
    frequency: frequencyEnum,
    // Usados so quando a frequencia e "Personalizado".
    interval: z.coerce.number().int().min(1).max(12).optional(),
    unit: z.enum(['WEEK', 'MONTH']).optional(),
    until: z.union([dateString, z.literal(''), z.null()]).optional(),
    count: z.union([z.coerce.number().int().min(1).max(RECURRENCE_MAX), z.literal(''), z.null()]).optional(),
    /// Só para as frequências em semanas. Vazio = repete no mesmo dia da
    /// semana da primeira data.
    weekdays: z.array(z.coerce.number().int().min(0).max(6)).max(7).optional(),
  })
  .refine((data) => data.until || data.count, {
    message: 'Informe até quando repetir ou quantas ocorrências criar',
    path: ['until'],
  })
  .refine((data) => data.frequency !== 'CUSTOM' || (data.interval && data.unit), {
    message: 'Na recorrência personalizada, informe o intervalo e a unidade',
    path: ['interval'],
  });

export const appointmentCreateSchema = z
  .object({
    clientId: z.string().uuid('Selecione um paciente'),
    date: dateString,
    startTime: timeString,
    endTime: timeString.optional(),
    duration: z.coerce.number().int().min(5).max(480).optional(),
    status: statusEnum.optional(),
    type: trimmed(60).optional(),
    notes: optionalText(8000),
    recurrence: recurrenceSchema.optional().nullable(),
  })
  .refine((data) => data.endTime || data.duration, {
    message: 'Informe a hora de término',
    path: ['endTime'],
  });

/// Alcance de uma alteracao ou exclusao dentro de uma serie.
export const SCOPES = ['one', 'following', 'series'];
const scopeEnum = z.enum(['one', 'following', 'series']).optional();

export const appointmentUpdateSchema = z.object({
  clientId: z.string().uuid().optional(),
  date: dateString.optional(),
  startTime: timeString.optional(),
  endTime: timeString.optional(),
  duration: z.coerce.number().int().min(5).max(480).optional(),
  status: statusEnum.optional(),
  type: trimmed(60).optional(),
  notes: optionalText(8000),
  scope: scopeEnum,
});

export const appointmentDeleteQuery = z.object({ scope: scopeEnum });

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
