import { prisma } from '../lib/prisma.js';
import { conflict, notFound } from '../utils/errors.js';
import {
  dateOnlyToUtc,
  utcToDateOnly,
  timeToMinutes,
  minutesToTime,
  overlaps,
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
  };
}

/// Calcula o fim a partir do inicio e da duracao em minutos.
function computeEnd(startTime, duration) {
  return minutesToTime(timeToMinutes(startTime) + duration);
}

/// Recusa dois atendimentos no mesmo intervalo do mesmo dia.
async function assertNoConflict({ date, startTime, endTime, ignoreId }) {
  const sameDay = await prisma.appointment.findMany({
    where: {
      date: dateOnlyToUtc(date),
      status: { in: BLOCKING_STATUS },
      ...(ignoreId ? { id: { not: ignoreId } } : {}),
    },
  });

  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  const clash = sameDay.find((item) =>
    overlaps(start, end, timeToMinutes(item.startTime), timeToMinutes(item.endTime)),
  );

  if (clash) throw conflict('Este horário já possui um agendamento.');
}

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

export async function createAppointment(input) {
  const endTime = input.endTime ?? computeEnd(input.startTime, input.duration ?? 50);
  if (timeToMinutes(endTime) <= timeToMinutes(input.startTime)) {
    throw conflict('O horário final precisa ser depois do inicial.');
  }

  await assertNoConflict({ date: input.date, startTime: input.startTime, endTime });

  const created = await prisma.appointment.create({
    data: {
      clientId: input.clientId,
      date: dateOnlyToUtc(input.date),
      startTime: input.startTime,
      endTime,
      status: input.status ?? 'AGENDADO',
      type: input.type ?? 'Consulta',
      notes: input.notes || null,
    },
    include: { client: true },
  });

  return serializeAppointment(created);
}

export async function updateAppointment(id, input) {
  const current = await prisma.appointment.findUnique({ where: { id } });
  if (!current) throw notFound('Atendimento não encontrado');

  const date = input.date ?? utcToDateOnly(current.date);
  const startTime = input.startTime ?? current.startTime;
  const endTime =
    input.endTime ??
    (input.duration ? computeEnd(startTime, input.duration) : undefined) ??
    (input.startTime
      ? computeEnd(startTime, timeToMinutes(current.endTime) - timeToMinutes(current.startTime))
      : current.endTime);

  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    throw conflict('O horário final precisa ser depois do inicial.');
  }

  const status = input.status ?? current.status;
  if (BLOCKING_STATUS.includes(status)) {
    await assertNoConflict({ date, startTime, endTime, ignoreId: id });
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data: {
      clientId: input.clientId ?? current.clientId,
      date: dateOnlyToUtc(date),
      startTime,
      endTime,
      status,
      type: input.type ?? current.type,
      notes: input.notes === undefined ? current.notes : input.notes || null,
    },
    include: { client: true },
  });

  return serializeAppointment(updated);
}

export async function deleteAppointment(id) {
  await prisma.appointment.delete({ where: { id } });
}

/// Numeros discretos mostrados no topo da agenda.
export async function getSummary({ today, weekStart, weekEnd }) {
  const todayUtc = dateOnlyToUtc(today);

  const [todayList, weekCount] = await Promise.all([
    prisma.appointment.findMany({
      where: { date: todayUtc, status: { in: BLOCKING_STATUS } },
      orderBy: { startTime: 'asc' },
      include: { client: true },
    }),
    prisma.appointment.count({
      where: {
        date: { gte: dateOnlyToUtc(weekStart), lte: dateOnlyToUtc(weekEnd) },
        status: { in: BLOCKING_STATUS },
      },
    }),
  ]);

  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const upcoming =
    todayList.find((item) => timeToMinutes(item.startTime) >= nowMinutes) ?? null;

  return {
    todayCount: todayList.length,
    weekCount,
    next: upcoming ? serializeAppointment(upcoming) : null,
  };
}
