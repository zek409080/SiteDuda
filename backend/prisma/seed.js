/**
 * Dados ficticios para experimentar o sistema.
 *
 *   node prisma/seed.js           cria os dados de teste
 *   node prisma/seed.js --clear   apaga TODOS os clientes e atendimentos
 *
 * Os clientes de teste sao marcados nas observacoes com [DADOS DE TESTE],
 * entao da para reconhece-los facilmente antes de apagar.
 */
import { PrismaClient } from '@prisma/client';
import { getSettings } from '../src/services/settings.service.js';

const prisma = new PrismaClient();
const MARK = '[DADOS DE TESTE]';

function dayOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

const CLIENTS = [
  { name: 'Maria Silva', phone: '(11) 98888-1010', email: 'maria.silva@exemplo.com', birthDate: '1990-04-12' },
  { name: 'Joao Souza', phone: '(11) 97777-2020', email: 'joao.souza@exemplo.com', birthDate: '1985-11-03' },
  { name: 'Ana Costa', phone: '(11) 96666-3030', email: null, birthDate: '1998-07-22' },
  { name: 'Pedro Almeida', phone: '(11) 95555-4040', email: 'pedro.almeida@exemplo.com', birthDate: null },
  { name: 'Beatriz Lima', phone: '(11) 94444-5050', email: null, birthDate: '2001-01-30' },
];

// [indice do cliente, dias a partir de hoje, hora, status]
const APPOINTMENTS = [
  [0, -21, '14:00', 'REALIZADO'],
  [0, -14, '14:00', 'REALIZADO'],
  [0, -7, '14:00', 'CANCELADO'],
  [0, 0, '14:00', 'CONFIRMADO'],
  [0, 7, '14:00', 'AGENDADO'],
  [1, -14, '10:00', 'REALIZADO'],
  [1, -7, '10:00', 'FALTOU'],
  [1, 1, '10:00', 'AGENDADO'],
  [2, -7, '15:00', 'REALIZADO'],
  [2, 0, '15:00', 'AGENDADO'],
  [2, 8, '15:00', 'AGENDADO'],
  [3, 0, '09:00', 'CONFIRMADO'],
  [3, 5, '09:00', 'AGENDADO'],
  [4, 2, '16:00', 'AGENDADO'],
  [4, 9, '16:00', 'AGENDADO'],
];

const NOTES = [
  'Sessao tranquila, seguiu bem o combinado da semana anterior.',
  'Trouxe questoes do trabalho. Continuar acompanhando.',
  'Remarcou por motivo pessoal.',
  null,
];

async function clear() {
  const appointments = await prisma.appointment.deleteMany({});
  const clients = await prisma.client.deleteMany({});
  console.log(`Removidos ${appointments.count} atendimentos e ${clients.count} clientes.`);
}

async function seed() {
  const settings = await getSettings();
  const duration = settings.defaultDuration;

  const existing = await prisma.client.count();
  if (existing > 0) {
    console.log(`O banco ja tem ${existing} cliente(s). Nada foi criado.`);
    console.log('Use "npm run seed:clear" antes, se quiser recomecar do zero.');
    return;
  }

  const created = [];
  for (const client of CLIENTS) {
    created.push(
      await prisma.client.create({
        data: {
          name: client.name,
          phone: client.phone,
          email: client.email,
          birthDate: client.birthDate ? new Date(`${client.birthDate}T00:00:00Z`) : null,
          notes: MARK,
        },
      }),
    );
  }

  let count = 0;
  for (const [index, offset, startTime, status] of APPOINTMENTS) {
    const [h, m] = startTime.split(':').map(Number);
    const end = h * 60 + m + duration;
    await prisma.appointment.create({
      data: {
        clientId: created[index].id,
        date: dayOffset(offset),
        startTime,
        endTime: `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`,
        status,
        type: 'Consulta',
        notes: NOTES[count % NOTES.length],
      },
    });
    count += 1;
  }

  console.log(`Criados ${created.length} clientes e ${count} atendimentos de teste.`);
}

const run = process.argv.includes('--clear') ? clear : seed;

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
