/**
 * Testes de integracao: sobem a API real (com o Prisma real) em uma porta
 * livre e conversam com ela por HTTP, exatamente como o frontend faria.
 *
 * Precisam de DATABASE_URL configurada (.env) e do banco com as migrations
 * aplicadas. Os registros criados aqui usam nomes/datas exclusivos e sao
 * removidos ao final, nao interferindo nos dados reais.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { prisma, disconnectPrisma } from '../src/lib/prisma.js';
import { env } from '../src/config/env.js';

const MARK = 'Teste Automatizado (pode apagar)';
const TEST_DATE = '2031-01-15'; // data distante, nunca colide com dados reais

function start() {
  const app = createApp();
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

/// Cliente HTTP minimo que guarda o cookie de sessao entre chamadas,
/// do mesmo jeito que o navegador faz.
function client(baseUrl) {
  let cookie = '';
  async function call(path, options = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    return { status: res.status, body };
  }
  return {
    get: (path) => call(path),
    post: (path, data) => call(path, { method: 'POST', body: JSON.stringify(data) }),
    put: (path, data) => call(path, { method: 'PUT', body: JSON.stringify(data) }),
    del: (path) => call(path, { method: 'DELETE' }),
  };
}

test('fluxo completo da API', async (t) => {
  const server = await start();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const api = client(baseUrl);
  let clientId;
  let appointmentId;

  await t.test('GET /api/health responde sem autenticacao', async () => {
    const { status, body } = await api.get('/api/health');
    assert.equal(status, 200);
    assert.equal(body.ok, true);
  });

  await t.test('rota protegida sem sessao retorna 401', async () => {
    const { status } = await api.get('/api/clients');
    assert.equal(status, 401);
  });

  await t.test('login com PIN errado retorna 401', async () => {
    const { status, body } = await api.post('/api/auth/login', { pin: '0000' });
    assert.equal(status, 401);
    assert.match(body.error, /incorreto/i);
  });

  await t.test('login com o PIN configurado autentica', async () => {
    const { status, body } = await api.post('/api/auth/login', { pin: env.initialPin });
    assert.equal(status, 200);
    assert.ok(body.settings);
  });

  await t.test('GET /api/auth/session confirma a sessao', async () => {
    const { status } = await api.get('/api/auth/session');
    assert.equal(status, 200);
  });

  await t.test('criar cliente invalido retorna 400 com detalhes', async () => {
    const { status, body } = await api.post('/api/clients', { name: 'A', phone: '1' });
    assert.equal(status, 400);
    assert.ok(body.details.length > 0);
  });

  await t.test('criar cliente valido retorna 201', async () => {
    const { status, body } = await api.post('/api/clients', {
      name: MARK,
      phone: '(11) 90000-0000',
      notes: MARK,
    });
    assert.equal(status, 201);
    assert.equal(body.name, MARK);
    clientId = body.id;
  });

  await t.test('cliente aparece na listagem e na pesquisa', async () => {
    const all = await api.get('/api/clients');
    assert.ok(all.body.some((c) => c.id === clientId));

    const found = await api.get(`/api/clients?search=${encodeURIComponent(MARK)}`);
    assert.ok(found.body.some((c) => c.id === clientId));
  });

  await t.test('editar cliente atualiza os dados', async () => {
    const { status, body } = await api.put(`/api/clients/${clientId}`, {
      name: `${MARK} (editado)`,
      phone: '(11) 91111-1111',
    });
    assert.equal(status, 200);
    assert.match(body.name, /editado/);
  });

  await t.test('criar agendamento valido retorna 201', async () => {
    const { status, body } = await api.post('/api/appointments', {
      clientId,
      date: TEST_DATE,
      startTime: '14:00',
      duration: 50,
      notes: 'observacao privada de teste',
    });
    assert.equal(status, 201);
    assert.equal(body.endTime, '14:50');
    assert.equal(body.status, 'AGENDADO');
    appointmentId = body.id;
  });

  await t.test('agendamento no mesmo horario e recusado com 409', async () => {
    const { status, body } = await api.post('/api/appointments', {
      clientId,
      date: TEST_DATE,
      startTime: '14:20',
      duration: 30,
    });
    assert.equal(status, 409);
    assert.equal(body.error, 'Este horário já possui um agendamento.');
  });

  await t.test('agendamento em horario livre no mesmo dia e aceito', async () => {
    const { status, body } = await api.post('/api/appointments', {
      clientId,
      date: TEST_DATE,
      startTime: '16:00',
      duration: 30,
    });
    assert.equal(status, 201);
    // limpa este segundo agendamento imediatamente, so precisavamos do teste
    await api.del(`/api/appointments/${body.id}`);
  });

  await t.test('marcar como realizado atualiza o status', async () => {
    const { status, body } = await api.put(`/api/appointments/${appointmentId}`, {
      status: 'REALIZADO',
    });
    assert.equal(status, 200);
    assert.equal(body.status, 'REALIZADO');
  });

  await t.test('historico do cliente mostra o atendimento', async () => {
    const { status, body } = await api.get(`/api/clients/${clientId}/appointments`);
    assert.equal(status, 200);
    assert.ok(body.some((a) => a.id === appointmentId && a.status === 'REALIZADO'));
  });

  await t.test('GET e PUT /api/settings funcionam', async () => {
    const before = await api.get('/api/settings');
    assert.equal(before.status, 200);

    const updated = await api.put('/api/settings', {
      professionalName: before.body.professionalName,
      workStart: before.body.workStart,
      workEnd: before.body.workEnd,
      defaultDuration: before.body.defaultDuration,
      workDays: before.body.workDays,
    });
    assert.equal(updated.status, 200);
  });

  await t.test('excluir cliente tambem remove os agendamentos (cascade)', async () => {
    const del = await api.del(`/api/clients/${clientId}`);
    assert.equal(del.status, 204);

    const getClient = await api.get(`/api/clients/${clientId}`);
    assert.equal(getClient.status, 404);

    const orphan = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    assert.equal(orphan, null);
  });

  await t.test('logout encerra a sessao', async () => {
    await api.post('/api/auth/logout', {});
    const { status } = await api.get('/api/auth/session');
    assert.equal(status, 401);
  });

  server.close();
  await disconnectPrisma();
});
