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
import { hashPin } from '../src/services/auth.service.js';
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
    const { extraHeaders, ...rest } = options;
    const res = await fetch(`${baseUrl}${path}`, {
      ...rest,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...extraHeaders,
      },
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    return { status: res.status, body, setCookie };
  }
  return {
    get: (path, extraHeaders) => call(path, { extraHeaders }),
    post: (path, data, extraHeaders) =>
      call(path, { method: 'POST', body: JSON.stringify(data), extraHeaders }),
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

  await t.test('cookie de sessao e httpOnly e nao vaza para JavaScript', async () => {
    const { setCookie } = await api.post('/api/auth/login', { pin: env.initialPin });
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);
  });

  await t.test('em http local o cookie nao exige HTTPS (senao o login quebraria)', async () => {
    const { setCookie } = await api.post('/api/auth/login', { pin: env.initialPin });
    assert.ok(!/;\s*Secure/i.test(setCookie), 'cookie nao deveria exigir HTTPS em http local');
  });

  await t.test('fora de producao o cabecalho de proto encaminhado e ignorado', async () => {
    // Sem proxy real na frente, confiar em X-Forwarded-* deixaria o cliente
    // forjar tanto o protocolo quanto o proprio IP. A flag Secure sob HTTPS
    // e verificada com o servidor em modo producao, em production.test.js.
    const { setCookie } = await api.post(
      '/api/auth/login',
      { pin: env.initialPin },
      { 'X-Forwarded-Proto': 'https' },
    );
    assert.ok(!/;\s*Secure/i.test(setCookie));
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

  await t.test('configuracoes nunca expoem campos internos', async () => {
    const { body } = await api.get('/api/settings');
    for (const campo of ['accessPin', 'sessionVersion', 'failedAttempts', 'lockedUntil']) {
      assert.ok(!(campo in body), `campo interno "${campo}" vazou na resposta`);
    }
  });

  await t.test('PIN novo com menos de 6 digitos e recusado', async () => {
    const before = await api.get('/api/settings');
    const { status } = await api.put('/api/settings', {
      professionalName: before.body.professionalName,
      workStart: before.body.workStart,
      workEnd: before.body.workEnd,
      defaultDuration: before.body.defaultDuration,
      workDays: before.body.workDays,
      newPin: '1234',
    });
    assert.equal(status, 400);
  });

  await t.test('excluir cliente tambem remove os agendamentos (cascade)', async () => {
    const del = await api.del(`/api/clients/${clientId}`);
    assert.equal(del.status, 204);

    const getClient = await api.get(`/api/clients/${clientId}`);
    assert.equal(getClient.status, 404);

    const orphan = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    assert.equal(orphan, null);
  });

  await t.test('logout invalida o token, e nao so apaga o cookie', async () => {
    // Guarda o cookie ANTES de sair e tenta reutilizar depois: um token
    // apenas "esquecido" pelo navegador continuaria valendo no servidor.
    const roubado = await api.post('/api/auth/login', { pin: env.initialPin });
    const cookieRoubado = roubado.setCookie.split(';')[0];

    await api.post('/api/auth/logout', {});

    const res = await fetch(`${baseUrl}/api/clients`, { headers: { Cookie: cookieRoubado } });
    assert.equal(res.status, 401, 'token deveria ter sido invalidado no servidor');
  });

  await t.test('trocar o PIN derruba as sessoes abertas em outros aparelhos', async () => {
    // "Outro aparelho" ja logado.
    const outro = await api.post('/api/auth/login', { pin: env.initialPin });
    const cookieOutro = outro.setCookie.split(';')[0];

    // Sessao atual troca o PIN.
    await api.post('/api/auth/login', { pin: env.initialPin });
    const atual = await api.get('/api/settings');
    const troca = await api.put('/api/settings', {
      professionalName: atual.body.professionalName,
      workStart: atual.body.workStart,
      workEnd: atual.body.workEnd,
      defaultDuration: atual.body.defaultDuration,
      workDays: atual.body.workDays,
      newPin: '778899',
    });
    assert.equal(troca.status, 200);

    const antigo = await fetch(`${baseUrl}/api/clients`, { headers: { Cookie: cookieOutro } });
    assert.equal(antigo.status, 401, 'sessao antiga deveria cair ao trocar o PIN');

    // Quem trocou continua conectada (recebeu cookie novo na resposta).
    const continua = await api.get('/api/settings');
    assert.equal(continua.status, 200, 'quem trocou o PIN deveria seguir conectada');

    // Restaura o PIN original para nao afetar os outros testes.
    const volta = await api.put('/api/settings', {
      professionalName: atual.body.professionalName,
      workStart: atual.body.workStart,
      workEnd: atual.body.workEnd,
      defaultDuration: atual.body.defaultDuration,
      workDays: atual.body.workDays,
      newPin: String(env.initialPin).padEnd(6, '0'),
    });
    assert.equal(volta.status, 200);
    await prisma.settings.update({
      where: { id: 1 },
      data: { accessPin: await hashPin(env.initialPin), failedAttempts: 0, lockedUntil: null },
    });
  });

  await t.test('bloqueio por tentativas nao e burlavel forjando o IP', async () => {
    await prisma.settings.update({
      where: { id: 1 },
      data: { failedAttempts: 0, lockedUntil: null },
    });

    // Cada tentativa vem de um IP forjado diferente. Se a protecao dependesse
    // do IP, nunca bloquearia. O bloqueio mora no banco, entao trava assim mesmo.
    let bloqueou = false;
    for (let i = 0; i < 6; i += 1) {
      const { status } = await api.post(
        '/api/auth/login',
        { pin: '000000' },
        { 'X-Forwarded-For': `203.0.113.${i + 1}` },
      );
      if (status === 429) {
        bloqueou = true;
        break;
      }
    }
    assert.ok(bloqueou, 'deveria ter bloqueado mesmo variando o IP a cada tentativa');

    // Ate o PIN correto e recusado enquanto o bloqueio estiver valendo.
    const durante = await api.post('/api/auth/login', { pin: env.initialPin });
    assert.equal(durante.status, 429);

    await prisma.settings.update({
      where: { id: 1 },
      data: { failedAttempts: 0, lockedUntil: null },
    });
  });

  server.close();
  await disconnectPrisma();
});
