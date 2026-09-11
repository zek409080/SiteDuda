/**
 * Testes de horário livre e de agendamento recorrente.
 *
 * As datas ficam em 2032/2033 para nunca esbarrar em dados reais nem nos
 * outros arquivos de teste.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { prisma, disconnectPrisma } from '../src/lib/prisma.js';
import { hashPin } from '../src/services/auth.service.js';
import { env } from '../src/config/env.js';
import { generateRecurrenceDates } from '../src/services/appointments.service.js';

const MARK = 'Recorrencia Teste (pode apagar)';

function start() {
  const app = createApp();
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

function client(baseUrl) {
  let cookie = '';
  async function call(target, { method = 'GET', body } = {}) {
    const res = await fetch(`${baseUrl}${target}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }
  return {
    get: (p) => call(p),
    post: (p, body) => call(p, { method: 'POST', body }),
    put: (p, body) => call(p, { method: 'PUT', body }),
    del: (p) => call(p, { method: 'DELETE' }),
  };
}

/* ------------------------- geração de datas ------------------------- */

test('geração das datas da série', async (t) => {
  await t.test('mensalmente com data final gera exatamente a sequência pedida', () => {
    const datas = generateRecurrenceDates('2026-09-23', {
      frequency: 'MONTHLY',
      until: '2026-12-23',
    });
    assert.deepEqual(datas, ['2026-09-23', '2026-10-23', '2026-11-23', '2026-12-23']);
  });

  await t.test('mensalmente por quantidade de ocorrências', () => {
    const datas = generateRecurrenceDates('2026-09-23', { frequency: 'MONTHLY', count: 3 });
    assert.deepEqual(datas, ['2026-09-23', '2026-10-23', '2026-11-23']);
  });

  await t.test('semanalmente mantém o dia da semana', () => {
    const datas = generateRecurrenceDates('2026-09-23', { frequency: 'WEEKLY', count: 5 });
    assert.deepEqual(datas, [
      '2026-09-23',
      '2026-09-30',
      '2026-10-07',
      '2026-10-14',
      '2026-10-21',
    ]);
  });

  await t.test('a cada 2 semanas', () => {
    const datas = generateRecurrenceDates('2026-09-23', { frequency: 'BIWEEKLY', count: 5 });
    assert.deepEqual(datas, [
      '2026-09-23',
      '2026-10-07',
      '2026-10-21',
      '2026-11-04',
      '2026-11-18',
    ]);
  });

  await t.test('a cada 2 meses', () => {
    const datas = generateRecurrenceDates('2026-09-23', { frequency: 'BIMONTHLY', count: 3 });
    assert.deepEqual(datas, ['2026-09-23', '2026-11-23', '2027-01-23']);
  });

  await t.test('personalizado: a cada 3 semanas e a cada 2 meses', () => {
    assert.deepEqual(
      generateRecurrenceDates('2026-09-23', {
        frequency: 'CUSTOM',
        unit: 'WEEK',
        interval: 3,
        count: 3,
      }),
      ['2026-09-23', '2026-10-14', '2026-11-04'],
    );
    assert.deepEqual(
      generateRecurrenceDates('2026-09-23', {
        frequency: 'CUSTOM',
        unit: 'MONTH',
        interval: 2,
        count: 3,
      }),
      ['2026-09-23', '2026-11-23', '2027-01-23'],
    );
  });

  await t.test('dias da semana escolhidos geram uma data por dia marcado', () => {
    // 2026-09-23 é uma quarta-feira. Marcando segunda e quarta:
    const datas = generateRecurrenceDates('2026-09-23', {
      frequency: 'WEEKLY',
      weekdays: [1, 3],
      count: 5,
    });
    assert.deepEqual(datas, [
      '2026-09-23', // qua (a própria)
      '2026-09-28', // seg
      '2026-09-30', // qua
      '2026-10-05', // seg
      '2026-10-07', // qua
    ]);
  });

  await t.test('fim de mês: encosta no último dia e volta ao dia de origem', () => {
    const datas = generateRecurrenceDates('2026-01-31', { frequency: 'MONTHLY', count: 5 });
    assert.deepEqual(datas, [
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ]);
  });

  await t.test('ano bissexto: fevereiro de 2028 tem dia 29', () => {
    const datas = generateRecurrenceDates('2028-01-31', { frequency: 'MONTHLY', count: 2 });
    assert.deepEqual(datas, ['2028-01-31', '2028-02-29']);
  });

  await t.test('série que atravessa a virada do ano', () => {
    const datas = generateRecurrenceDates('2026-12-23', { frequency: 'MONTHLY', until: '2027-02-28' });
    assert.deepEqual(datas, ['2026-12-23', '2027-01-23', '2027-02-23']);
  });

  await t.test('data final antes da primeira data cria só a primeira', () => {
    const datas = generateRecurrenceDates('2026-09-23', {
      frequency: 'WEEKLY',
      until: '2026-09-01',
    });
    assert.deepEqual(datas, ['2026-09-23']);
  });
});

/* --------------------------- via HTTP --------------------------- */

test('horário livre e recorrência pela API', async (t) => {
  const server = await start();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const api = client(baseUrl);
  let pacienteId;
  let outroPacienteId;

  await prisma.settings.update({
    where: { id: 1 },
    data: { accessPin: await hashPin(env.initialPin), failedAttempts: 0, lockedUntil: null },
  });

  await t.test('login e pacientes de teste', async () => {
    assert.equal((await api.post('/api/auth/login', { pin: env.initialPin })).status, 200);

    const um = await api.post('/api/clients', { name: `${MARK} A`, phone: '11900000001' });
    const dois = await api.post('/api/clients', { name: `${MARK} B`, phone: '11900000002' });
    pacienteId = um.body.id;
    outroPacienteId = dois.body.id;
  });

  await t.test('minutos livres são aceitos sem arredondar', async () => {
    const horarios = ['08:01', '09:17', '12:43', '14:32', '17:10', '18:59', '23:01'];
    for (const [i, inicio] of horarios.entries()) {
      const { status, body } = await api.post('/api/appointments', {
        clientId: pacienteId,
        date: `2032-03-${String(i + 1).padStart(2, '0')}`,
        startTime: inicio,
        endTime: '23:59',
      });
      assert.equal(status, 201, `recusou ${inicio}`);
      assert.equal(body.startTime, inicio, `arredondou ${inicio}`);
    }
  });

  await t.test('hora de término livre é preservada', async () => {
    const { status, body } = await api.post('/api/appointments', {
      clientId: pacienteId,
      date: '2032-03-20',
      startTime: '17:10',
      endTime: '18:03',
    });
    assert.equal(status, 201);
    assert.equal(body.startTime, '17:10');
    assert.equal(body.endTime, '18:03');
    assert.equal(body.recurrenceGroupId, null);
  });

  await t.test('hora de término igual ou anterior à de início é recusada', async () => {
    for (const fim of ['17:10', '16:00']) {
      const { status, body } = await api.post('/api/appointments', {
        clientId: pacienteId,
        date: '2032-03-21',
        startTime: '17:10',
        endTime: fim,
      });
      assert.equal(status, 400);
      assert.equal(body.error, 'A hora de término deve ser posterior à hora de início.');
    }
  });

  await t.test('recorrência sem limite algum é recusada', async () => {
    const { status, body } = await api.post('/api/appointments', {
      clientId: pacienteId,
      date: '2032-04-01',
      startTime: '10:00',
      endTime: '11:00',
      recurrence: { frequency: 'MONTHLY' },
    });
    assert.equal(status, 400);
    assert.match(body.details[0].mensagem, /até quando|ocorrências/i);
  });

  let grupoMensal;
  await t.test('mensal com data final grava as 4 ocorrências no banco', async () => {
    const { status, body } = await api.post('/api/appointments', {
      clientId: pacienteId,
      date: '2032-09-23',
      startTime: '17:10',
      endTime: '18:00',
      type: 'Consulta',
      recurrence: { frequency: 'MONTHLY', until: '2032-12-23' },
    });

    assert.equal(status, 201);
    assert.equal(body.recurrence.createdCount, 4);
    assert.equal(body.recurrence.skipped.length, 0);
    grupoMensal = body.recurrence.groupId;

    const serie = await prisma.appointment.findMany({
      where: { recurrenceGroupId: grupoMensal },
      orderBy: { date: 'asc' },
    });
    assert.deepEqual(
      serie.map((a) => a.date.toISOString().slice(0, 10)),
      ['2032-09-23', '2032-10-23', '2032-11-23', '2032-12-23'],
    );
    // mesmo horário, paciente, tipo e duração em todas
    for (const item of serie) {
      assert.equal(item.startTime, '17:10');
      assert.equal(item.endTime, '18:00');
      assert.equal(item.clientId, pacienteId);
      assert.equal(item.type, 'Consulta');
      assert.equal(item.recurrenceGroupId, grupoMensal);
    }
  });

  await t.test('a agenda devolve as 4 ocorrências no período', async () => {
    const { body } = await api.get('/api/appointments?from=2032-09-01&to=2032-12-31');
    const daSerie = body.filter((a) => a.recurrenceGroupId === grupoMensal);
    assert.equal(daSerie.length, 4);
    assert.ok(daSerie.every((a) => a.startTime === '17:10'));
  });

  await t.test('horário ocupado no futuro é pulado, sem apagar o que existe', async () => {
    // ocupa 2033-02-10 com outro paciente
    const existente = await api.post('/api/appointments', {
      clientId: outroPacienteId,
      date: '2033-02-10',
      startTime: '09:30',
      endTime: '10:30',
    });
    assert.equal(existente.status, 201);

    const { status, body } = await api.post('/api/appointments', {
      clientId: pacienteId,
      date: '2033-01-10',
      startTime: '09:00',
      endTime: '10:00',
      recurrence: { frequency: 'MONTHLY', count: 3 },
    });

    assert.equal(status, 201);
    assert.equal(body.recurrence.createdCount, 2); // jan e mar; fev caiu fora
    assert.equal(body.recurrence.skipped.length, 1);
    assert.equal(body.recurrence.skipped[0].date, '2033-02-10');
    assert.equal(body.recurrence.skipped[0].conflitoCom, `${MARK} B`);

    // o agendamento que já existia continua intacto
    const intacto = await api.get(`/api/appointments/${existente.body.id}`);
    assert.equal(intacto.status, 200);
    assert.equal(intacto.body.startTime, '09:30');
  });

  await t.test('conflito na primeira data não cria nada', async () => {
    const antes = await prisma.appointment.count();
    const { status } = await api.post('/api/appointments', {
      clientId: pacienteId,
      date: '2033-02-10',
      startTime: '10:00',
      endTime: '11:00',
      recurrence: { frequency: 'MONTHLY', count: 3 },
    });
    assert.equal(status, 409);
    assert.equal(await prisma.appointment.count(), antes);
  });

  /* ------------------------ edição da série ------------------------ */

  const daSerie = async (grupo) =>
    (await prisma.appointment.findMany({
      where: { recurrenceGroupId: grupo },
      orderBy: { date: 'asc' },
    })).map((a) => `${a.date.toISOString().slice(0, 10)} ${a.startTime}-${a.endTime}`);

  await t.test('editar somente uma ocorrência não mexe nas outras', async () => {
    const serie = await prisma.appointment.findMany({
      where: { recurrenceGroupId: grupoMensal },
      orderBy: { date: 'asc' },
    });
    const outubro = serie[1];

    const { status, body } = await api.put(`/api/appointments/${outubro.id}`, {
      startTime: '18:20',
      endTime: '19:10',
    });
    assert.equal(status, 200);
    assert.equal(body.startTime, '18:20');
    assert.equal(body.series, undefined);

    assert.deepEqual(await daSerie(grupoMensal), [
      '2032-09-23 17:10-18:00',
      '2032-10-23 18:20-19:10',
      '2032-11-23 17:10-18:00',
      '2032-12-23 17:10-18:00',
    ]);
  });

  await t.test('editar "este e os próximos" preserva a data de cada ocorrência', async () => {
    const serie = await prisma.appointment.findMany({
      where: { recurrenceGroupId: grupoMensal },
      orderBy: { date: 'asc' },
    });
    const novembro = serie[2];

    const { status, body } = await api.put(`/api/appointments/${novembro.id}`, {
      startTime: '15:45',
      endTime: '16:35',
      scope: 'following',
    });
    assert.equal(status, 200);
    assert.equal(body.series.updatedCount, 2);

    assert.deepEqual(await daSerie(grupoMensal), [
      '2032-09-23 17:10-18:00', // antes: não mudou
      '2032-10-23 18:20-19:10', // antes: não mudou
      '2032-11-23 15:45-16:35',
      '2032-12-23 15:45-16:35',
    ]);
  });

  await t.test('editar "toda a série" alcança todas, cada uma na sua data', async () => {
    const serie = await prisma.appointment.findMany({
      where: { recurrenceGroupId: grupoMensal },
      orderBy: { date: 'asc' },
    });

    const { status, body } = await api.put(`/api/appointments/${serie[3].id}`, {
      startTime: '08:05',
      endTime: '09:00',
      type: 'Retorno',
      scope: 'series',
    });
    assert.equal(status, 200);
    assert.equal(body.series.updatedCount, 4);

    assert.deepEqual(await daSerie(grupoMensal), [
      '2032-09-23 08:05-09:00',
      '2032-10-23 08:05-09:00',
      '2032-11-23 08:05-09:00',
      '2032-12-23 08:05-09:00',
    ]);
    const todos = await prisma.appointment.findMany({ where: { recurrenceGroupId: grupoMensal } });
    assert.ok(todos.every((a) => a.type === 'Retorno'));
  });

  /* ----------------------- cancelamento ----------------------- */

  await t.test('cancelar somente uma ocorrência mantém as demais', async () => {
    const serie = await prisma.appointment.findMany({
      where: { recurrenceGroupId: grupoMensal },
      orderBy: { date: 'asc' },
    });

    const { status, body } = await api.del(`/api/appointments/${serie[1].id}`);
    assert.equal(status, 200);
    assert.equal(body.deletedCount, 1);

    const restantes = await daSerie(grupoMensal);
    assert.equal(restantes.length, 3);
    assert.equal(restantes.some((d) => d.startsWith('2032-10-23')), false);
  });

  await t.test('cancelar "este e os próximos" para na data escolhida', async () => {
    const serie = await prisma.appointment.findMany({
      where: { recurrenceGroupId: grupoMensal },
      orderBy: { date: 'asc' },
    });
    // sobraram set, nov, dez — cancela a partir de novembro
    const { status, body } = await api.del(`/api/appointments/${serie[1].id}?scope=following`);
    assert.equal(status, 200);
    assert.equal(body.deletedCount, 2);

    const restantes = await daSerie(grupoMensal);
    assert.equal(restantes.length, 1);
    assert.ok(restantes[0].startsWith('2032-09-23'));
  });

  await t.test('cancelar toda a série remove o que resta', async () => {
    const { body: criada } = await api.post('/api/appointments', {
      clientId: pacienteId,
      date: '2033-06-01',
      startTime: '14:32',
      endTime: '15:22',
      recurrence: { frequency: 'WEEKLY', count: 4 },
    });
    assert.equal(criada.recurrence.createdCount, 4);

    const serie = await prisma.appointment.findMany({
      where: { recurrenceGroupId: criada.recurrence.groupId },
      orderBy: { date: 'asc' },
    });
    const { status, body } = await api.del(`/api/appointments/${serie[2].id}?scope=series`);
    assert.equal(status, 200);
    assert.equal(body.deletedCount, 4);
    assert.equal(
      await prisma.appointment.count({ where: { recurrenceGroupId: criada.recurrence.groupId } }),
      0,
    );
  });

  await t.test('alcance inválido é recusado', async () => {
    const serie = await prisma.appointment.findMany({
      where: { recurrenceGroupId: grupoMensal },
    });
    const { status } = await api.del(`/api/appointments/${serie[0].id}?scope=tudo`);
    assert.equal(status, 400);
  });

  await t.test('atendimento avulso ignora o alcance e apaga só a si mesmo', async () => {
    const { body } = await api.post('/api/appointments', {
      clientId: pacienteId,
      date: '2033-08-08',
      startTime: '11:11',
      endTime: '12:12',
    });
    const { status } = await api.del(`/api/appointments/${body.id}?scope=series`);
    assert.equal(status, 200);
    assert.equal(await prisma.appointment.count({ where: { id: body.id } }), 0);
  });

  await t.test('nenhuma ocorrência ficou sem paciente', async () => {
    const orfaos = await prisma.$queryRaw`
      SELECT count(*)::int AS n FROM appointments a
      LEFT JOIN clients c ON c.id = a.client_id WHERE c.id IS NULL`;
    assert.equal(orfaos[0].n, 0);
  });

  await prisma.client.deleteMany({ where: { name: { startsWith: MARK } } });
  await disconnectPrisma();
  server.close();
});
