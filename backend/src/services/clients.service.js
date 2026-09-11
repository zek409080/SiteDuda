import { prisma } from '../lib/prisma.js';
import { notFound } from '../utils/errors.js';
import { dateOnlyToUtc, utcToDateOnly } from '../utils/time.js';
import { serializeAppointment } from './appointments.service.js';
import { removeStoredFile } from '../lib/storage.js';

const blankToNull = (value) => {
  const text = typeof value === 'string' ? value.trim() : value;
  return text ? text : null;
};

function serializeResponsible(row) {
  return {
    id: row.id,
    name: row.name,
    relation: row.relation,
    phone: row.phone,
    email: row.email,
    notes: row.notes,
  };
}

function serializeAllergy(row) {
  return { id: row.id, name: row.name, notes: row.notes };
}

function serializeMedication(row) {
  return {
    id: row.id,
    name: row.name,
    dosage: row.dosage,
    frequency: row.frequency,
    notes: row.notes,
  };
}

/// As listas so aparecem quando foram carregadas junto (perfil do paciente).
/// Na listagem geral elas ficam de fora, para nao trazer dado que a tela
/// nao usa.
export function serializeClient(client) {
  const base = {
    id: client.id,
    name: client.name,
    phone: client.phone,
    email: client.email,
    birthDate: client.birthDate ? utcToDateOnly(client.birthDate) : null,
    address: client.address,
    hasAllergies: client.hasAllergies,
    notes: client.notes,
    createdAt: client.createdAt,
  };

  if (client.responsibles) base.responsibles = client.responsibles.map(serializeResponsible);
  if (client.allergies) base.allergies = client.allergies.map(serializeAllergy);
  if (client.medications) base.medications = client.medications.map(serializeMedication);

  return base;
}

const withDetails = {
  responsibles: { orderBy: { createdAt: 'asc' } },
  allergies: { orderBy: { createdAt: 'asc' } },
  medications: { orderBy: { createdAt: 'asc' } },
};

function toData(input) {
  return {
    name: input.name,
    phone: input.phone,
    email: blankToNull(input.email),
    birthDate: input.birthDate ? dateOnlyToUtc(input.birthDate) : null,
    address: blankToNull(input.address),
    hasAllergies: Boolean(input.hasAllergies),
    notes: blankToNull(input.notes),
  };
}

/*
 * Responsaveis, alergias e medicamentos sao salvos junto com o paciente:
 * o formulario envia a lista inteira e o servidor grava exatamente aquilo.
 * Nao ha referencia externa a essas linhas, entao regravar e mais simples
 * (e mais previsivel) do que casar item a item procurando o que mudou.
 */
function responsibleRows(list = []) {
  return list
    .filter((item) => item?.name?.trim())
    .map((item) => ({
      name: item.name.trim(),
      relation: item.relation?.trim() || 'Outro',
      phone: blankToNull(item.phone),
      email: blankToNull(item.email),
      notes: blankToNull(item.notes),
    }));
}

function allergyRows(list = [], hasAllergies) {
  // Marcou "nenhuma alergia conhecida": a lista nao e gravada.
  if (!hasAllergies) return [];
  return list
    .filter((item) => item?.name?.trim())
    .map((item) => ({ name: item.name.trim(), notes: blankToNull(item.notes) }));
}

function medicationRows(list = []) {
  return list
    .filter((item) => item?.name?.trim())
    .map((item) => ({
      name: item.name.trim(),
      dosage: blankToNull(item.dosage),
      frequency: blankToNull(item.frequency),
      notes: blankToNull(item.notes),
    }));
}

/// Lista pacientes em ordem alfabetica, com a proxima consulta de cada um.
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
  const client = await prisma.client.findUnique({ where: { id }, include: withDetails });
  if (!client) throw notFound('Paciente não encontrado');
  return serializeClient(client);
}

export async function createClient(input) {
  const created = await prisma.client.create({
    data: {
      ...toData(input),
      responsibles: { create: responsibleRows(input.responsibles) },
      allergies: { create: allergyRows(input.allergies, input.hasAllergies) },
      medications: { create: medicationRows(input.medications) },
    },
    include: withDetails,
  });
  return serializeClient(created);
}

/// Tudo em uma transacao: ou o paciente e as listas mudam juntos, ou nada
/// muda. Sem isso, uma falha no meio deixaria o paciente sem as listas.
export async function updateClient(id, input) {
  const updated = await prisma.$transaction(async (tx) => {
    const exists = await tx.client.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw notFound('Paciente não encontrado');

    await tx.clientResponsible.deleteMany({ where: { clientId: id } });
    await tx.clientAllergy.deleteMany({ where: { clientId: id } });
    await tx.clientMedication.deleteMany({ where: { clientId: id } });

    return tx.client.update({
      where: { id },
      data: {
        ...toData(input),
        responsibles: { create: responsibleRows(input.responsibles) },
        allergies: { create: allergyRows(input.allergies, input.hasAllergies) },
        medications: { create: medicationRows(input.medications) },
      },
      include: withDetails,
    });
  });

  return serializeClient(updated);
}

/// Apagar o paciente apaga o historico e as listas dele (cascade no schema).
/// Os arquivos em disco o banco nao alcanca, entao sao removidos aqui —
/// senao sobrariam documentos sem dono ocupando espaco para sempre.
export async function deleteClient(id) {
  const documents = await prisma.clientDocument.findMany({
    where: { clientId: id },
    select: { storagePath: true },
  });

  await prisma.client.delete({ where: { id } });

  for (const doc of documents) {
    await removeStoredFile(doc.storagePath);
  }
}

/// Historico completo de um paciente, do mais recente para o mais antigo.
export async function listClientAppointments(id) {
  await getClient(id);
  const appointments = await prisma.appointment.findMany({
    where: { clientId: id },
    orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
  });
  return appointments.map(serializeAppointment);
}
