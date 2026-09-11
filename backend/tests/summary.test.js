import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma.js';
import { getSummary } from '../src/services/appointments.service.js';
import { summaryQuerySchema } from '../src/routes/schemas.js';

function mockQuery(t, method, implementation) {
  const original = prisma.appointment[method];
  prisma.appointment[method] = implementation;
  t.after(() => { prisma.appointment[method] = original; });
}

const query = { today: '2026-09-11', nowTime: '14:30', weekStart: '2026-09-07', weekEnd: '2026-09-13' };

test('resumo busca atendimentos futuros, ordena por data/hora e preserva contagens', async (t) => {
  const counts = [];
  mockQuery(t, 'count', async (args) => {
    counts.push(args);
    return counts.length === 1 ? 3 : 4;
  });
  mockQuery(t, 'findFirst', async (args) => {
    assert.deepEqual(args.where.status.in, ['AGENDADO', 'CONFIRMADO']);
    assert.deepEqual(args.where.OR, [
      { date: new Date('2026-09-11T00:00:00Z'), startTime: { gte: '14:30' } },
      { date: { gt: new Date('2026-09-11T00:00:00Z') } },
    ]);
    assert.deepEqual(args.orderBy, [{ date: 'asc' }, { startTime: 'asc' }]);
    assert.equal(args.include.client, true);
    return {
      id: 'test', date: new Date('2026-09-14T00:00:00Z'), startTime: '08:00',
      endTime: '08:50', status: 'CONFIRMADO', client: { id: 'patient', name: 'Paciente fictício' },
    };
  });
  const result = await getSummary(query);
  assert.equal(result.todayCount, 3);
  assert.equal(result.weekCount, 4);
  assert.equal(result.next.date, '2026-09-14');
  assert.equal(result.next.client.name, 'Paciente fictício');
  assert.deepEqual(counts[0].where.status.in, ['AGENDADO', 'CONFIRMADO', 'REALIZADO']);
  assert.deepEqual(counts[1].where.date, { gte: new Date('2026-09-07T00:00:00Z'), lte: new Date('2026-09-13T00:00:00Z') });
});

test('sem atendimento futuro retorna next nulo sem descartar as contagens', async (t) => {
  mockQuery(t, 'count', async () => 2);
  mockQuery(t, 'findFirst', async () => null);
  assert.deepEqual(await getSummary(query), { todayCount: 2, weekCount: 2, next: null });
});

test('cliente antigo usa horário de São Paulo mesmo com servidor em UTC', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-11T17:30:00Z') });
  mockQuery(t, 'count', async () => 0);
  mockQuery(t, 'findFirst', async ({ where }) => {
    assert.equal(where.OR[0].startTime.gte, '14:30');
    return null;
  });
  const { nowTime, ...legacyQuery } = query;
  await getSummary(legacyQuery);
});

test('hora do navegador é validada e continua opcional para clientes antigos', () => {
  assert.equal(summaryQuerySchema.parse(query).nowTime, '14:30');
  assert.equal(summaryQuerySchema.safeParse({ ...query, nowTime: '25:99' }).success, false);
  const { nowTime, ...legacyQuery } = query;
  assert.equal(summaryQuerySchema.safeParse(legacyQuery).success, true);
});
