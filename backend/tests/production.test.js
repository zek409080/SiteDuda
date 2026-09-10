/**
 * Verifica o comportamento do servidor EM MODO PRODUCAO.
 *
 * Sobe o servidor num processo separado com as variaveis que uma hospedagem
 * define, porque o modo (producao ou desenvolvimento) e decidido quando o
 * modulo de configuracao carrega — nao da para simular isso no mesmo processo.
 *
 * O que e checado aqui e justamente o que falhou no deploy real: cookie sem
 * a flag Secure, CORS liberando localhost e falta de politica de conteudo.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4455;
const BASE = `http://127.0.0.1:${PORT}`;

function startProductionServer() {
  const child = spawn(process.execPath, [path.join(backendRoot, 'src', 'server.js')], {
    cwd: backendRoot,
    env: {
      ...process.env,
      PORT: String(PORT),
      // Variavel que o Railway define sozinho; e assim que o app conclui
      // que esta publicado, mesmo sem NODE_ENV configurado.
      RAILWAY_ENVIRONMENT: 'production',
      NODE_ENV: 'production',
      CORS_ORIGIN: '',
    },
    stdio: 'ignore',
  });

  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 30000;
    const tick = async () => {
      if (child.exitCode !== null) return reject(new Error('servidor encerrou antes de subir'));
      try {
        const res = await fetch(`${BASE}/api/health`);
        if (res.ok) return resolve(child);
      } catch {
        // ainda subindo
      }
      if (Date.now() > deadline) return reject(new Error('servidor nao subiu a tempo'));
      setTimeout(tick, 300);
    };
    tick();
  });
}

test('comportamento em modo producao', async (t) => {
  const server = await startProductionServer();

  try {
    await t.test('cookie de sessao recebe Secure atras de HTTPS', async () => {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-Proto': 'https' },
        body: JSON.stringify({ pin: process.env.ACCESS_PIN ?? '1234' }),
      });
      const setCookie = res.headers.get('set-cookie') ?? '';
      assert.match(setCookie, /Secure/, 'faltou a flag Secure');
      assert.match(setCookie, /HttpOnly/);
      assert.match(setCookie, /SameSite=Lax/i);
    });

    await t.test('CORS nao libera localhost em producao', async () => {
      const res = await fetch(`${BASE}/api/health`, {
        headers: { Origin: 'http://localhost:5173' },
      });
      assert.equal(
        res.headers.get('access-control-allow-origin'),
        null,
        'producao nao deveria autorizar origem externa',
      );
    });

    await t.test('politica de conteudo presente e restritiva', async () => {
      const res = await fetch(`${BASE}/api/health`);
      const csp = res.headers.get('content-security-policy');
      assert.ok(csp, 'Content-Security-Policy ausente');
      assert.match(csp, /default-src 'self'/);
      assert.match(csp, /script-src 'self'/);
      assert.match(csp, /frame-ancestors 'none'/);
      assert.match(csp, /object-src 'none'/);
      assert.ok(!/script-src[^;]*unsafe-inline/.test(csp), 'script inline nao deveria ser liberado');
      assert.ok(!/script-src[^;]*unsafe-eval/.test(csp), 'eval nao deveria ser liberado');
    });

    await t.test('demais cabecalhos de seguranca presentes', async () => {
      const res = await fetch(`${BASE}/api/health`);
      assert.match(res.headers.get('strict-transport-security') ?? '', /max-age=\d{7,}/);
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      assert.ok(res.headers.get('referrer-policy'));
      assert.match(res.headers.get('permissions-policy') ?? '', /camera=\(\)/);
      assert.match(res.headers.get('x-robots-tag') ?? '', /noindex/);
      assert.equal(res.headers.get('x-powered-by'), null);
    });

    await t.test('erro inesperado nao devolve detalhe interno', async () => {
      const res = await fetch(`${BASE}/api/rota-que-nao-existe`);
      const body = await res.json();
      assert.equal(res.status, 404);
      assert.ok(!('details' in body) || body.details === undefined);
    });
  } finally {
    server.kill();
  }
});
