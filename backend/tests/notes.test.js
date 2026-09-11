/**
 * Testes do bloco de notas da profissional.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { prisma, disconnectPrisma } from '../src/lib/prisma.js';
import { hashPin } from '../src/services/auth.service.js';
import { env } from '../src/config/env.js';

const MARK = 'Nota de Teste (pode apagar)';

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

test('notas da profissional', async (t) => {
  const server = await start();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const api = client(baseUrl);
  const ids = {};

  await prisma.settings.update({
    where: { id: 1 },
    data: { accessPin: await hashPin(env.initialPin), failedAttempts: 0, lockedUntil: null },
  });

  await t.test('sem sessao nenhuma rota de nota responde', async () => {
    const anonimo = client(baseUrl);
    assert.equal((await anonimo.get('/api/notes')).status, 401);
    assert.equal((await anonimo.post('/api/notes', { title: 'x' })).status, 401);
  });

  await t.test('login', async () => {
    assert.equal((await api.post('/api/auth/login', { pin: env.initialPin })).status, 200);
  });

  await t.test('cria tres notas', async () => {
    for (const [chave, titulo, conteudo] of [
      ['um', `${MARK} 1`, 'Ligar para a paciente e confirmar o horário.'],
      ['dois', `${MARK} 2`, 'Comprar material para o consultório.'],
      ['tres', `${MARK} 3`, 'Reunião na sexta-feira, 14h.'],
    ]) {
      const { status, body } = await api.post('/api/notes', { title: titulo, content: conteudo });
      assert.equal(status, 201);
      assert.equal(body.title, titulo);
      assert.equal(body.content, conteudo);
      assert.ok(body.createdAt);
      assert.ok(body.updatedAt);
      ids[chave] = body.id;
    }
  });

  await t.test('nota sem conteúdo é aceita (o título já é o lembrete)', async () => {
    const { status, body } = await api.post('/api/notes', { title: `${MARK} curta` });
    assert.equal(status, 201);
    assert.equal(body.content, '');
    ids.curta = body.id;
  });

  await t.test('título vazio é recusado', async () => {
    const { status, body } = await api.post('/api/notes', { title: '', content: 'algo' });
    assert.equal(status, 400);
    // A tela mostra o detalhe do campo, nao o "Dados inválidos" generico.
    assert.match(body.details[0].mensagem, /título/i);
    assert.equal(body.details[0].campo, 'title');
  });

  await t.test('a lista traz as notas gravadas', async () => {
    const { status, body } = await api.get('/api/notes');
    assert.equal(status, 200);
    const minhas = body.filter((n) => n.title.startsWith(MARK));
    assert.equal(minhas.length, 4);
  });

  await t.test('editar a nota 2 muda título e conteúdo', async () => {
    const { status, body } = await api.put(`/api/notes/${ids.dois}`, {
      title: `${MARK} 2 (editada)`,
      content: 'Comprar material E agendar manutenção do ar.',
    });
    assert.equal(status, 200);
    assert.equal(body.title, `${MARK} 2 (editada)`);
    assert.match(body.content, /manutenção/);
    assert.notEqual(body.updatedAt, body.createdAt);
  });

  await t.test('excluir a nota 1 não afeta as outras', async () => {
    assert.equal((await api.del(`/api/notes/${ids.um}`)).status, 204);

    const { body } = await api.get('/api/notes');
    const titulos = body.filter((n) => n.title.startsWith(MARK)).map((n) => n.title);
    assert.equal(titulos.includes(`${MARK} 1`), false);
    assert.ok(titulos.includes(`${MARK} 2 (editada)`));
    assert.ok(titulos.includes(`${MARK} 3`));
  });

  await t.test('a alteração está no banco, não só na resposta', async () => {
    const noBanco = await prisma.note.findUnique({ where: { id: ids.dois } });
    assert.equal(noBanco.title, `${MARK} 2 (editada)`);
    assert.equal(await prisma.note.findUnique({ where: { id: ids.um } }), null);
  });

  await t.test('editar ou excluir nota inexistente responde 404', async () => {
    const fantasma = '00000000-0000-4000-8000-000000000000';
    assert.equal((await api.put(`/api/notes/${fantasma}`, { title: 'x y' })).status, 404);
    assert.equal((await api.del(`/api/notes/${fantasma}`)).status, 404);
  });

  await t.test('id fora do formato não chega ao banco', async () => {
    assert.equal((await api.del('/api/notes/nao-e-uuid')).status, 400);
  });

  await prisma.note.deleteMany({ where: { title: { startsWith: MARK } } });
  await disconnectPrisma();
  server.close();
});
