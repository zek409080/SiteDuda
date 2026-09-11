/**
 * Testes das funcionalidades de paciente: responsaveis, alergias,
 * medicamentos e documentos.
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

// Precisa valer ANTES de carregar o modulo de armazenamento, que le esta
// variavel uma unica vez ao ser importado.
const TEST_UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'agenda-uploads-'));
process.env.UPLOAD_DIR = TEST_UPLOAD_DIR;

const { createApp } = await import('../src/app.js');
const { prisma, disconnectPrisma } = await import('../src/lib/prisma.js');
const { hashPin } = await import('../src/services/auth.service.js');
const { env } = await import('../src/config/env.js');

const MARK = 'Paciente de Teste (pode apagar)';

function start() {
  const app = createApp();
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

function client(baseUrl) {
  let cookie = '';
  async function call(target, { method = 'GET', body, raw, headers } = {}) {
    const res = await fetch(`${baseUrl}${target}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      // FormData vai sem Content-Type manual: o fetch monta o cabecalho com
      // a fronteira (boundary) correta sozinho.
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
    put: (p, body) => call(p, { method: 'PUT', body }),
    del: (p) => call(p, { method: 'DELETE' }),
    upload: (p, form) => call(p, { method: 'POST', raw: form }),
  };
}

/// PDF minimo de verdade, para o teste nao depender de arquivo fixo no disco.
const PDF_BYTES = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n', 'latin1');
const PNG_BYTES = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6300000002000148afa4710000000049454e44ae426082',
  'hex',
);

const filePart = (bytes, name, type) => new File([bytes], name, { type });

test('pacientes: dados de saude e documentos', async (t) => {
  const server = await start();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const api = client(baseUrl);

  let patientId;
  let pdfDocId;

  // Garante um PIN conhecido para esta rodada.
  await prisma.settings.update({
    where: { id: 1 },
    data: { accessPin: await hashPin(env.initialPin), failedAttempts: 0, lockedUntil: null },
  });

  await t.test('login', async () => {
    const { status } = await api.post('/api/auth/login', { pin: env.initialPin });
    assert.equal(status, 200);
  });

  await t.test('cria paciente com responsavel, alergia e medicamento', async () => {
    const { status, body } = await api.post('/api/clients', {
      name: MARK,
      phone: '11988887777',
      email: 'paciente.teste@example.com',
      birthDate: '2014-03-22',
      address: 'Rua das Acacias, 100 - Sao Paulo',
      notes: 'Observacao geral do paciente.',
      hasAllergies: true,
      responsibles: [
        {
          name: 'Maria Responsavel',
          relation: 'Mãe',
          phone: '11977776666',
          email: 'mae@example.com',
          notes: 'Contato preferencial',
        },
      ],
      allergies: [{ name: 'Penicilina', notes: 'Reacao na pele' }],
      medications: [
        { name: 'Sertralina', dosage: '50 mg', frequency: '1 vez ao dia', notes: 'Uso continuo' },
      ],
    });

    assert.equal(status, 201);
    assert.equal(body.address, 'Rua das Acacias, 100 - Sao Paulo');
    assert.equal(body.hasAllergies, true);
    assert.equal(body.responsibles.length, 1);
    assert.equal(body.responsibles[0].relation, 'Mãe');
    assert.equal(body.allergies.length, 1);
    assert.equal(body.medications[0].dosage, '50 mg');
    patientId = body.id;
  });

  await t.test('recarregar o paciente traz tudo do banco', async () => {
    const { status, body } = await api.get(`/api/clients/${patientId}`);
    assert.equal(status, 200);
    assert.equal(body.birthDate, '2014-03-22');
    assert.equal(body.responsibles[0].name, 'Maria Responsavel');
    assert.equal(body.allergies[0].name, 'Penicilina');
    assert.equal(body.medications[0].frequency, '1 vez ao dia');
  });

  await t.test('editar responsavel e adicionar um segundo', async () => {
    const { body: atual } = await api.get(`/api/clients/${patientId}`);
    const { status, body } = await api.put(`/api/clients/${patientId}`, {
      ...atual,
      responsibles: [
        { ...atual.responsibles[0], phone: '11955554444' },
        { name: 'Joao Responsavel', relation: 'Pai', phone: '11944443333' },
      ],
    });

    assert.equal(status, 200);
    assert.equal(body.responsibles.length, 2);
    assert.equal(body.responsibles.find((r) => r.relation === 'Mãe').phone, '11955554444');
    assert.ok(body.responsibles.some((r) => r.relation === 'Pai'));
  });

  await t.test('excluir um responsavel remove so o escolhido', async () => {
    const { body: atual } = await api.get(`/api/clients/${patientId}`);
    const mantido = atual.responsibles.filter((r) => r.relation !== 'Pai');
    const { body } = await api.put(`/api/clients/${patientId}`, { ...atual, responsibles: mantido });

    assert.equal(body.responsibles.length, 1);
    assert.equal(body.responsibles[0].relation, 'Mãe');
  });

  await t.test('alergias e medicamentos aceitam varios itens e exclusao', async () => {
    const { body: atual } = await api.get(`/api/clients/${patientId}`);

    const { body: comDois } = await api.put(`/api/clients/${patientId}`, {
      ...atual,
      allergies: [...atual.allergies, { name: 'Dipirona', notes: '' }],
      medications: [...atual.medications, { name: 'Melatonina', dosage: '3 mg' }],
    });
    assert.equal(comDois.allergies.length, 2);
    assert.equal(comDois.medications.length, 2);

    const { body: comUm } = await api.put(`/api/clients/${patientId}`, {
      ...comDois,
      allergies: comDois.allergies.filter((a) => a.name !== 'Dipirona'),
      medications: comDois.medications.filter((m) => m.name !== 'Melatonina'),
    });
    assert.equal(comUm.allergies.length, 1);
    assert.equal(comUm.allergies[0].name, 'Penicilina');
    assert.equal(comUm.medications.length, 1);
  });

  await t.test('marcar "nenhuma alergia conhecida" limpa a lista', async () => {
    const { body: atual } = await api.get(`/api/clients/${patientId}`);
    const { body } = await api.put(`/api/clients/${patientId}`, { ...atual, hasAllergies: false });
    assert.equal(body.hasAllergies, false);
    assert.equal(body.allergies.length, 0);

    const { body: devolta } = await api.put(`/api/clients/${patientId}`, {
      ...body,
      hasAllergies: true,
      allergies: [{ name: 'Penicilina', notes: 'Reacao na pele' }],
    });
    assert.equal(devolta.allergies.length, 1);
  });

  await t.test('envia PDF, JPG e DOCX', async () => {
    const envios = [
      [PDF_BYTES, 'Avaliação Inicial.pdf', 'application/pdf'],
      [PNG_BYTES, 'foto.jpg', 'image/jpeg'],
      [PDF_BYTES, 'relatorio.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ];

    for (const [bytes, nome, tipo] of envios) {
      const form = new FormData();
      form.append('file', filePart(bytes, nome, tipo));
      const { status, body } = await api.upload(`/api/clients/${patientId}/documents`, form);
      assert.equal(status, 201, `falhou ao enviar ${nome}`);
      assert.equal(body.originalName, nome);
      assert.equal(body.mimeType, tipo);
      assert.ok(body.fileSize > 0);
      assert.ok(body.createdAt);
      if (tipo === 'application/pdf') pdfDocId = body.id;
    }
  });

  await t.test('a lista de documentos traz os tres, sem o caminho em disco', async () => {
    const { status, body } = await api.get(`/api/clients/${patientId}/documents`);
    assert.equal(status, 200);
    assert.equal(body.length, 3);
    assert.equal(body[0].storagePath, undefined);
    assert.equal(body[0].storageName, undefined);
  });

  await t.test('formato nao aceito e recusado', async () => {
    const form = new FormData();
    form.append('file', filePart(Buffer.from('<script>alert(1)</script>'), 'x.html', 'text/html'));
    const { status, body } = await api.upload(`/api/clients/${patientId}/documents`, form);
    assert.equal(status, 400);
    assert.match(body.error, /PDF|aceito/i);
  });

  await t.test('arquivo acima do limite e recusado', async () => {
    const form = new FormData();
    form.append('file', filePart(Buffer.alloc(11 * 1024 * 1024, 0x41), 'grande.pdf', 'application/pdf'));
    const { status, body } = await api.upload(`/api/clients/${patientId}/documents`, form);
    assert.equal(status, 400);
    assert.match(body.error, /grande|limite/i);
  });

  await t.test('o arquivo e gravado com nome gerado pelo servidor', async () => {
    const doc = await prisma.clientDocument.findUnique({ where: { id: pdfDocId } });
    assert.notEqual(doc.storageName, 'Avaliação Inicial.pdf');
    assert.match(doc.storageName, /^[0-9a-f-]{36}\.pdf$/);
    assert.ok(fs.existsSync(path.join(TEST_UPLOAD_DIR, doc.storageName)));
  });

  await t.test('visualizar o documento devolve o arquivo', async () => {
    const { status, res, text } = await api.get(`/api/clients/${patientId}/documents/${pdfDocId}/file`);
    assert.equal(status, 200);
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    assert.match(res.headers.get('content-disposition'), /^inline/);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(text.startsWith('%PDF'));

    // Politica propria da rota de arquivo: sem script, mas com object-src
    // liberado para o visualizador de PDF do navegador conseguir abrir.
    const csp = res.headers.get('content-security-policy');
    assert.match(csp, /default-src 'none'/);
    assert.match(csp, /object-src 'self'/);
    assert.doesNotMatch(csp, /script-src/);
    assert.equal(res.headers.get('cache-control'), 'private, no-store');
  });

  await t.test('baixar forca download com o nome original', async () => {
    const { status, res } = await api.get(`/api/clients/${patientId}/documents/${pdfDocId}/file?download=1`);
    assert.equal(status, 200);
    const disposition = res.headers.get('content-disposition');
    assert.match(disposition, /^attachment/);
    assert.match(disposition, /Avalia/);
  });

  await t.test('DOC/DOCX nunca abre no navegador, sempre baixa', async () => {
    const { body: docs } = await api.get(`/api/clients/${patientId}/documents`);
    const docx = docs.find((d) => d.originalName.endsWith('.docx'));
    const { res } = await api.get(`/api/clients/${patientId}/documents/${docx.id}/file`);
    assert.match(res.headers.get('content-disposition'), /^attachment/);
  });

  await t.test('documento de um paciente nao abre pela URL de outro', async () => {
    const { body: outro } = await api.post('/api/clients', {
      name: `${MARK} B`,
      phone: '11900001111',
    });

    const { status } = await api.get(`/api/clients/${outro.id}/documents/${pdfDocId}/file`);
    assert.equal(status, 404);

    const { status: statusDelete } = await api.del(`/api/clients/${outro.id}/documents/${pdfDocId}`);
    assert.equal(statusDelete, 404);

    // e o documento continua intacto no dono verdadeiro
    const { status: statusDono } = await api.get(`/api/clients/${patientId}/documents/${pdfDocId}/file`);
    assert.equal(statusDono, 200);
  });

  await t.test('sem sessao nenhuma rota de documento responde', async () => {
    const semSessao = client(baseUrl);
    const rotas = [
      `/api/clients/${patientId}/documents`,
      `/api/clients/${patientId}/documents/${pdfDocId}/file`,
    ];
    for (const rota of rotas) {
      const { status } = await semSessao.get(rota);
      assert.equal(status, 401, `rota aberta sem sessao: ${rota}`);
    }
  });

  await t.test('id inexistente responde 404, sem detalhe interno', async () => {
    const inexistente = '00000000-0000-4000-8000-000000000000';
    const { status, body } = await api.get(`/api/clients/${patientId}/documents/${inexistente}/file`);
    assert.equal(status, 404);
    assert.match(body.error, /não encontrado/i);
  });

  await t.test('id fora do formato esperado nao chega ao banco', async () => {
    const { status } = await api.get(`/api/clients/${patientId}/documents/..%2F..%2Fetc%2Fpasswd/file`);
    assert.equal(status, 400);
  });

  await t.test('excluir o documento apaga o registro e o arquivo', async () => {
    const doc = await prisma.clientDocument.findUnique({ where: { id: pdfDocId } });
    const caminho = path.join(TEST_UPLOAD_DIR, doc.storageName);
    assert.ok(fs.existsSync(caminho));

    const { status } = await api.del(`/api/clients/${patientId}/documents/${pdfDocId}`);
    assert.equal(status, 204);

    assert.equal(await prisma.clientDocument.findUnique({ where: { id: pdfDocId } }), null);
    assert.equal(fs.existsSync(caminho), false, 'o arquivo ficou orfao no disco');
  });

  await t.test('excluir o paciente leva junto listas e arquivos', async () => {
    const docs = await prisma.clientDocument.findMany({ where: { clientId: patientId } });
    assert.ok(docs.length > 0);
    const caminhos = docs.map((d) => path.join(TEST_UPLOAD_DIR, d.storageName));

    const { status } = await api.del(`/api/clients/${patientId}`);
    assert.equal(status, 204);

    assert.equal(await prisma.clientDocument.count({ where: { clientId: patientId } }), 0);
    assert.equal(await prisma.clientResponsible.count({ where: { clientId: patientId } }), 0);
    assert.equal(await prisma.clientAllergy.count({ where: { clientId: patientId } }), 0);
    assert.equal(await prisma.clientMedication.count({ where: { clientId: patientId } }), 0);
    for (const caminho of caminhos) {
      assert.equal(fs.existsSync(caminho), false, 'sobrou arquivo de paciente excluido');
    }
  });

  await t.test('nao sobra registro orfao no banco', async () => {
    const [resp, aler, medi, docs] = await Promise.all([
      prisma.$queryRaw`SELECT count(*)::int AS n FROM client_responsibles r LEFT JOIN clients c ON c.id = r.client_id WHERE c.id IS NULL`,
      prisma.$queryRaw`SELECT count(*)::int AS n FROM client_allergies a LEFT JOIN clients c ON c.id = a.client_id WHERE c.id IS NULL`,
      prisma.$queryRaw`SELECT count(*)::int AS n FROM client_medications m LEFT JOIN clients c ON c.id = m.client_id WHERE c.id IS NULL`,
      prisma.$queryRaw`SELECT count(*)::int AS n FROM client_documents d LEFT JOIN clients c ON c.id = d.client_id WHERE c.id IS NULL`,
    ]);
    assert.equal(resp[0].n, 0);
    assert.equal(aler[0].n, 0);
    assert.equal(medi[0].n, 0);
    assert.equal(docs[0].n, 0);
  });

  await prisma.client.deleteMany({ where: { name: { startsWith: MARK } } });
  await disconnectPrisma();
  fs.rmSync(TEST_UPLOAD_DIR, { recursive: true, force: true });
  server.close();
});
