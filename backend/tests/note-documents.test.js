/**
 * Testes dos anexos de nota.
 *
 * Os uploads vao para uma pasta temporaria propria (UPLOAD_DIR), apagada no
 * fim — os arquivos reais da profissional nunca sao tocados aqui.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Precisa valer ANTES de carregar o modulo de armazenamento.
const TEST_UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'agenda-notas-'));
process.env.UPLOAD_DIR = TEST_UPLOAD_DIR;

const { createApp } = await import('../src/app.js');
const { prisma, disconnectPrisma } = await import('../src/lib/prisma.js');
const { hashPin } = await import('../src/services/auth.service.js');
const { env } = await import('../src/config/env.js');

const MARK = 'Nota com anexo (pode apagar)';

const PDF_BYTES = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n', 'latin1');
const PNG_BYTES = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6300000002000148afa4710000000049454e44ae426082',
  'hex',
);

function start() {
  const app = createApp();
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

function client(baseUrl) {
  let cookie = '';
  async function call(target, { method = 'GET', body, raw } = {}) {
    const res = await fetch(`${baseUrl}${target}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: raw ?? (body ? JSON.stringify(body) : undefined),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const text = await res.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    return { status: res.status, body: parsed, res, text };
  }
  return {
    get: (p) => call(p),
    post: (p, body) => call(p, { method: 'POST', body }),
    del: (p) => call(p, { method: 'DELETE' }),
    upload: (p, form) => call(p, { method: 'POST', raw: form }),
  };
}

const filePart = (bytes, name, type) => new File([bytes], name, { type });

test('anexos de nota', async (t) => {
  const server = await start();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const api = client(baseUrl);

  let notaId;
  let outraNotaId;
  let docId;

  await prisma.settings.update({
    where: { id: 1 },
    data: { accessPin: await hashPin(env.initialPin), failedAttempts: 0, lockedUntil: null },
  });

  await t.test('login e duas notas', async () => {
    assert.equal((await api.post('/api/auth/login', { pin: env.initialPin })).status, 200);

    const uma = await api.post('/api/notes', { title: `${MARK} A`, content: 'Orçamento do material.' });
    const outra = await api.post('/api/notes', { title: `${MARK} B` });
    notaId = uma.body.id;
    outraNotaId = outra.body.id;

    // nota nova nasce sem anexo
    assert.equal(uma.body.documentCount, 0);
  });

  await t.test('sem sessao nenhuma rota de anexo responde', async () => {
    const anonimo = client(baseUrl);
    assert.equal((await anonimo.get(`/api/notes/${notaId}/documents`)).status, 401);
  });

  await t.test('envia PDF e imagem para a nota', async () => {
    for (const [bytes, nome, tipo] of [
      [PDF_BYTES, 'Orçamento gráfica.pdf', 'application/pdf'],
      [PNG_BYTES, 'foto da prateleira.png', 'image/png'],
    ]) {
      const form = new FormData();
      form.append('file', filePart(bytes, nome, tipo));
      const { status, body } = await api.upload(`/api/notes/${notaId}/documents`, form);
      assert.equal(status, 201, `falhou ao enviar ${nome}`);
      assert.equal(body.originalName, nome, 'acento no nome do arquivo');
      assert.equal(body.mimeType, tipo);
      assert.ok(body.fileSize > 0);
      if (tipo === 'application/pdf') docId = body.id;
    }
  });

  await t.test('a lista de anexos traz os dois, sem o caminho em disco', async () => {
    const { status, body } = await api.get(`/api/notes/${notaId}/documents`);
    assert.equal(status, 200);
    assert.equal(body.length, 2);
    assert.equal(body[0].storagePath, undefined);
    assert.equal(body[0].storageName, undefined);
  });

  await t.test('a nota passa a informar quantos anexos tem', async () => {
    const { body } = await api.get('/api/notes');
    const minha = body.find((n) => n.id === notaId);
    assert.equal(minha.documentCount, 2);
    assert.equal(body.find((n) => n.id === outraNotaId).documentCount, 0);
  });

  await t.test('formato nao aceito e recusado', async () => {
    const form = new FormData();
    form.append('file', filePart(Buffer.from('<script>alert(1)</script>'), 'x.html', 'text/html'));
    const { status, body } = await api.upload(`/api/notes/${notaId}/documents`, form);
    assert.equal(status, 400);
    assert.match(body.error, /PDF|aceito/i);
  });

  await t.test('o arquivo e gravado com nome gerado pelo servidor', async () => {
    const doc = await prisma.noteDocument.findUnique({ where: { id: docId } });
    assert.notEqual(doc.storageName, 'Orçamento gráfica.pdf');
    assert.match(doc.storageName, /^[0-9a-f-]{36}\.pdf$/);
    assert.ok(fs.existsSync(path.join(TEST_UPLOAD_DIR, doc.storageName)));
  });

  await t.test('visualizar devolve o arquivo com os cabecalhos certos', async () => {
    const { status, res, text } = await api.get(`/api/notes/${notaId}/documents/${docId}/file`);
    assert.equal(status, 200);
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    assert.match(res.headers.get('content-disposition'), /^inline/);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('cache-control'), 'private, no-store');
    assert.ok(text.startsWith('%PDF'));
  });

  await t.test('baixar forca download com o nome original', async () => {
    const { res } = await api.get(`/api/notes/${notaId}/documents/${docId}/file?download=1`);
    const disposition = res.headers.get('content-disposition');
    assert.match(disposition, /^attachment/);
    assert.match(disposition, /Or%C3%A7amento/);
  });

  await t.test('anexo de uma nota nao abre pela URL de outra', async () => {
    assert.equal((await api.get(`/api/notes/${outraNotaId}/documents/${docId}/file`)).status, 404);
    assert.equal((await api.del(`/api/notes/${outraNotaId}/documents/${docId}`)).status, 404);

    // e continua intacto na dona verdadeira
    assert.equal((await api.get(`/api/notes/${notaId}/documents/${docId}/file`)).status, 200);
  });

  await t.test('anexo de nota nao e alcancavel pela rota de paciente', async () => {
    const paciente = await prisma.client.findFirst({ select: { id: true } });
    if (!paciente) return; // banco sem pacientes: nada a conferir
    const { status } = await api.get(`/api/clients/${paciente.id}/documents/${docId}/file`);
    assert.equal(status, 404);
  });

  await t.test('nota inexistente responde 404', async () => {
    const fantasma = '00000000-0000-4000-8000-000000000000';
    assert.equal((await api.get(`/api/notes/${fantasma}/documents`)).status, 404);
  });

  await t.test('excluir o anexo apaga o registro e o arquivo', async () => {
    const doc = await prisma.noteDocument.findUnique({ where: { id: docId } });
    const caminho = path.join(TEST_UPLOAD_DIR, doc.storageName);
    assert.ok(fs.existsSync(caminho));

    assert.equal((await api.del(`/api/notes/${notaId}/documents/${docId}`)).status, 204);
    assert.equal(await prisma.noteDocument.findUnique({ where: { id: docId } }), null);
    assert.equal(fs.existsSync(caminho), false, 'o arquivo ficou orfao no disco');
  });

  await t.test('excluir a nota leva os anexos e os arquivos junto', async () => {
    const docs = await prisma.noteDocument.findMany({ where: { noteId: notaId } });
    assert.ok(docs.length > 0);
    const caminhos = docs.map((d) => path.join(TEST_UPLOAD_DIR, d.storageName));

    assert.equal((await api.del(`/api/notes/${notaId}`)).status, 204);

    assert.equal(await prisma.noteDocument.count({ where: { noteId: notaId } }), 0);
    for (const caminho of caminhos) {
      assert.equal(fs.existsSync(caminho), false, 'sobrou arquivo de nota excluida');
    }
  });

  await t.test('nao sobra anexo sem nota', async () => {
    const orfaos = await prisma.$queryRaw`
      SELECT count(*)::int AS n FROM note_documents d
      LEFT JOIN notes n ON n.id = d.note_id WHERE n.id IS NULL`;
    assert.equal(orfaos[0].n, 0);
  });

  await prisma.note.deleteMany({ where: { title: { startsWith: MARK } } });
  await disconnectPrisma();
  fs.rmSync(TEST_UPLOAD_DIR, { recursive: true, force: true });
  server.close();
});
