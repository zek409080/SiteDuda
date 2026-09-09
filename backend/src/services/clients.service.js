import { prisma } from '../lib/prisma.js';
import { notFound } from '../utils/errors.js';
import { dateOnlyToUtc, utcToDateOnly } from '../utils/time.js';
import { serializeAppointment } from './appointments.service.js';

export function serializeClient(client) {
  return {
    id: client.id,
    name: client.name,
    phone: client.phone,
    email: client.email,
    birthDate: client.birthDate ? utcToDateOnly(client.birthDate) : null,
    notes: client.notes,
    createdAt: client.createdAt,
  };
}

function toData(input) {
  return {
    name: input.name,
    phone: input.phone,
    email: input.email || null,
    birthDate: input.birthDate ? dateOnlyToUtc(input.birthDate) : null,
    notes: input.notes || null,
  };
}

/// Lista clientes em ordem alfabetica, com a proxima consulta de cada um.
/// A busca por nome/telefone acontece no banco, nao no navegador.
export async function listClients({ search } = {}) {
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
        ],
      }
    : {};

  const today = dateOnlyToUtc(new Date().toISOString().slice(0, 10));

  const clients = await prisma.client.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      appointments: {
        where: { date: { gte: today }, status: { in: ['AGENDADO', 'CONFIRMADO'] } },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
        take: 1,
      },
    },
  });

  return clients.map((client) => ({
    ...serializeClient(client),
    nextAppointment: client.appointments[0]
      ? serializeAppointment(client.appointments[0])
      : null,
  }));
}

export async function getClient(id) {
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) throw notFound('Cliente não encontrado');
  return serializeClient(client);
}

export async function createClient(input) {
  const created = await prisma.client.create({ data: toData(input) });
  return serializeClient(created);
}

export async function updateClient(id, input) {
  const updated = await prisma.client.update({ where: { id }, data: toData(input) });
  return serializeClient(updated);
}

/// Apagar o cliente apaga tambem o historico dele (cascade no schema).
export async function deleteClient(id) {
  await prisma.client.delete({ where: { id } });
}

/// Historico completo de um cliente, do mais recente para o mais antigo.
export async function listClientAppointments(id) {
  await getClient(id);
  const appointments = await prisma.appointment.findMany({
    where: { clientId: id },
    orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
  });
  return appointments.map(serializeAppointment);
}
