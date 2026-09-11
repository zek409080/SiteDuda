import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { RECURRENCE_MAX } from '../routes/schemas.js';
import {
  addDaysToDate,
  addMonthsToDate,
  dateOnlyToUtc,
  minutesToTime,
  overlaps,
  startOfWeekDate,
  timeToMinutes,
  utcToDateOnly,
  weekdayOfDate,
} from '../utils/time.js';

/// Um horario cancelado ou faltado deixa de ocupar a agenda.
const BLOCKING_STATUS = ['AGENDADO', 'CONFIRMADO', 'REALIZADO'];

export function serializeAppointment(appointment) {
  return {
    id: appointment.id,
    clientId: appointment.clientId,
    client: appointment.client
      ? { id: appointment.client.id, name: appointment.client.name, phone: appointment.client.phone }
      : undefined,
    date: utcToDateOnly(appointment.date),
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    status: appointment.status,
    type: appointment.type,
    notes: appointment.notes,
    // A tela usa isto para saber se precisa perguntar "só este ou a série?".
    recurrenceGroupId: appointment.recurrenceGroupId ?? null,
  };
}

/// Calcula o fim a partir do inicio e da duracao em minutos.
function computeEnd(startTime, duration) {
  return minutesToTime(timeToMinutes(startTime) + duration);
}

function assertTimeOrder(startTime, endTime) {
  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    throw badRequest('A hora de término deve ser posterior à hora de início.');
  }
}

/// Devolve o atendimento que ocupa o intervalo, ou undefined se estiver livre.
async function findConflict({ date, startTime, endTime, ignoreId }) {
  const sameDay = await prisma.appointment.findMany({
    where: {
      date: dateOnlyToUtc(date),
      status: { in: BLOCKING_STATUS },
      ...(ignoreId ? { id: { not: ignoreId } } : {}),
    },
    include: { client: true },
  });

  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  return sameDay.find((item) =>
    overlaps(start, end, timeToMinutes(item.startTime), timeToMinutes(item.endTime)),
  );
}

async function assertNoConflict(args) {
  if (await findConflict(args)) throw conflict('Este horário já possui um agendamento.');
}

/* ---------------------------------------------------------------------
 * Recorrencia
 * ------------------------------------------------------------------- */

function weekStep({ frequency, unit, interval }) {
  if (frequency === 'WEEKLY') return 1;
  if (frequency === 'BIWEEKLY') return 2;
  if (frequency === 'CUSTOM' && unit === 'WEEK') return interval;
  return null;
}

function monthStep({ frequency, unit, interval }) {
  if (frequency === 'MONTHLY') return 1;
  if (frequency === 'BIMONTHLY') return 2;
  if (frequency === 'CUSTOM' && unit === 'MONTH') return interval;
  return null;
}

/**
 * Datas de uma serie, sempre comecando pela data informada.
 *
 * As contas mensais partem sempre da data de origem (veja addMonthsToDate):
 * somar de mes em mes faria uma serie do dia 31 escorregar para o dia 28
 * depois de passar por fevereiro.
 *
 * `count` e `until` sao os dois limites possiveis; o schema exige pelo menos
 * um deles. RECURRENCE_MAX e o teto de seguranca, para um pedido malformado
 * nao encher a agenda.
 */
export function generateRecurrenceDates(startDate, recurrence) {
  const limit = recurrence.count ? Math.min(recurrence.count, RECURRENCE_MAX) : RECURRENCE_MAX;
  const until = recurrence.until || null;
  const beyond = (date) => Boolean(until) && date > until;

  const dates = new Set([startDate]);
  const weeks = weekStep(recurrence);

  if (weeks) {
    // Sem dias marcados, repete no mesmo dia da semana da primeira data.
    const selected = [
      ...new Set(recurrence.weekdays?.length ? recurrence.weekdays : [weekdayOfDate(startDate)]),
    ].sort((a, b) => a - b);

    const firstWeek = startOfWeekDate(startDate);
    for (let block = 0; block <= RECURRENCE_MAX * 2 && dates.size < limit; block += 1) {
      const weekStart = addDaysToDate(firstWeek, block * weeks * 7);
      if (beyond(weekStart)) break;
      for (const weekday of selected) {
        const date = addDaysToDate(weekStart, weekday);
        if (date < startDate || beyond(date)) continue;
        dates.add(date);
        if (dates.size >= limit) break;
      }
    }
  } else {
    const months = monthStep(recurrence);
    for (let i = 1; i <= RECURRENCE_MAX * 2 && dates.size < limit; i += 1) {
      const date = addMonthsToDate(startDate, i * months);
      if (beyond(date)) break;
      dates.add(date);
    }
  }

  return [...dates].sort().slice(0, limit);
}

/* ---------------------------------------------------------------------
 * Leitura
 * ------------------------------------------------------------------- */

/// Lista os atendimentos de um intervalo de datas (a agenda pede semana ou mes).
export async function listAppointments({ from, to, clientId } = {}) {
  const where = {};
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = dateOnlyToUtc(from);
    if (to) where.date.lte = dateOnlyToUtc(to);
  }
  if (clientId) where.clientId = clientId;

  const appointments = await prisma.appointment.findMany({
    where,
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    include: { client: true },
  });

  return appointments.map(serializeAppointment);
}

export async function getAppointment(id) {
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: { client: true },
  });
  if (!appointment) throw notFound('Atendimento não encontrado');
  return serializeAppointment(appointment);
}

/* ---------------------------------------------------------------------
 * Escrita
 * ------------------------------------------------------------------- */

export async function createAppointment(input) {
  const endTime = input.endTime ?? computeEnd(input.startTime, input.duration ?? 50);
  assertTimeOrder(input.startTime, endTime);

  const base = {
    clientId: input.clientId,
    startTime: input.startTime,
    endTime,
    status: input.status ?? 'AGENDADO',
    type: input.type ?? 'Consulta',
    notes: input.notes || null,
  };

  // A primeira ocorrencia e a que a profissional pediu explicitamente: se ela
  // nao couber, nada e criado e o erro aparece na tela.
  await assertNoConflict({ date: input.date, startTime: input.startTime, endTime });

  if (!input.recurrence) {
    const created = await prisma.appointment.create({
      data: { ...base, date: dateOnlyToUtc(input.date) },
      include: { client: true },
    });
    return serializeAppointment(created);
  }

  const dates = generateRecurrenceDates(input.date, input.recurrence);
  const recurrenceGroupId = randomUUID();
  const created = [];
  const skipped = [];

  for (const date of dates) {
    // Horario ocupado no futuro nao derruba o que ja existe: a ocorrencia e
    // pulada e a profissional decide o que fazer com ela.
    if (date !== input.date) {
      const clash = await findConflict({ date, startTime: input.startTime, endTime });
      if (clash) {
        skipped.push({
          date,
          startTime: input.startTime,
          conflitoCom: clash.client?.name ?? null,
        });
        continue;
      }
    }

    const row = await prisma.appointment.create({
      data: { ...base, date: dateOnlyToUtc(date), recurrenceGroupId },
      include: { client: true },
    });
    created.push(row);
  }

  return {
    ...serializeAppointment(created[0]),
    recurrence: { groupId: recurrenceGroupId, createdCount: created.length, skipped },
  };
}

/// Atendimentos alcancados por uma alteracao/exclusao, conforme o alcance
/// escolhido. Fora de uma serie, so o proprio atendimento.
async function seriesTargets(current, scope) {
  if (scope === 'one' || !current.recurrenceGroupId) return [current];

  return prisma.appointment.findMany({
    where: {
      recurrenceGroupId: current.recurrenceGroupId,
      ...(scope === 'following' ? { date: { gte: current.date } } : {}),
    },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });
}

/**
 * Altera um atendimento.
 *
 * Com `scope` "following" ou "series", o horario, o tipo, o status, o paciente
 * e a observacao passam a valer para as demais ocorrencias — mas a DATA de
 * cada uma e preservada, senao a serie inteira desabaria em um unico dia.
 */
export async function updateAppointment(id, input) {
  const current = await prisma.appointment.findUnique({ where: { id } });
  if (!current) throw notFound('Atendimento não encontrado');

  const scope = input.scope ?? 'one';
  const startTime = input.startTime ?? current.startTime;
  const endTime =
    input.endTime ??
    (input.duration ? computeEnd(startTime, input.duration) : undefined) ??
    (input.startTime
      ? computeEnd(startTime, timeToMinutes(current.endTime) - timeToMinutes(current.startTime))
      : current.endTime);

  assertTimeOrder(startTime, endTime);

  const status = input.status ?? current.status;
  const targets = await seriesTargets(current, scope);
  const skipped = [];
  let updatedSelf = null;

  for (const target of targets) {
    const isSelf = target.id === id;
    const date = isSelf ? (input.date ?? utcToDateOnly(current.date)) : utcToDateOnly(target.date);
    const targetStatus = isSelf ? status : (input.status ?? target.status);

    if (BLOCKING_STATUS.includes(targetStatus)) {
      const clash = await findConflict({ date, startTime, endTime, ignoreId: target.id });
      if (clash) {
        // O atendimento clicado e o que a profissional pediu: se ele nao
        // couber, a operacao inteira falha em vez de mudar so os outros.
        if (isSelf) throw conflict('Este horário já possui um agendamento.');
        skipped.push({ date, startTime, conflitoCom: clash.client?.name ?? null });
        continue;
      }
    }

    const row = await prisma.appointment.update({
      where: { id: target.id },
      data: {
        clientId: input.clientId ?? target.clientId,
        date: dateOnlyToUtc(date),
        startTime,
        endTime,
        status: targetStatus,
        type: input.type ?? target.type,
        notes: input.notes === undefined ? target.notes : input.notes || null,
      },
      include: { client: true },
    });

    if (isSelf) updatedSelf = row;
  }

  const result = serializeAppointment(updatedSelf);
  if (scope !== 'one' && current.recurrenceGroupId) {
    result.series = { scope, updatedCount: targets.length - skipped.length, skipped };
  }
  return result;
}

export async function deleteAppointment(id, scope = 'one') {
  const current = await prisma.appointment.findUnique({ where: { id } });
  if (!current) throw notFound('Atendimento não encontrado');

  if (scope === 'one' || !current.recurrenceGroupId) {
    await prisma.appointment.delete({ where: { id } });
    return { deletedCount: 1 };
  }

  const { count } = await prisma.appointment.deleteMany({
    where: {
      recurrenceGroupId: current.recurrenceGroupId,
      ...(scope === 'following' ? { date: { gte: current.date } } : {}),
    },
  });

  return { deletedCount: count };
}

/// Numeros discretos mostrados no topo da agenda.
export async function getSummary({ today, nowTime, weekStart, weekEnd }) {
  const todayUtc = dateOnlyToUtc(today);
  // O navegador envia data e hora no mesmo fuso. Compatibilidade com clientes
  // antigos: horario de Sao Paulo, independente do fuso do servidor Railway.
  const currentTime = nowTime ?? new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date());

  const [todayCount, weekCount, upcoming] = await Promise.all([
    prisma.appointment.count({
      where: { date: todayUtc, status: { in: BLOCKING_STATUS } },
    }),
    prisma.appointment.count({
      where: {
        date: { gte: dateOnlyToUtc(weekStart), lte: dateOnlyToUtc(weekEnd) },
        status: { in: BLOCKING_STATUS },
      },
    }),
    prisma.appointment.findFirst({
      where: {
        status: { in: ['AGENDADO', 'CONFIRMADO'] },
        OR: [
          { date: todayUtc, startTime: { gte: currentTime } },
          { date: { gt: todayUtc } },
        ],
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      include: { client: true },
    }),
  ]);

  return {
    todayCount,
    weekCount,
    next: upcoming ? serializeAppointment(upcoming) : null,
  };
}
