import { createApp } from './app.js';
import { env } from './config/env.js';
import { disconnectPrisma } from './lib/prisma.js';
import { getSettings } from './services/settings.service.js';

const app = createApp();

const server = app.listen(env.port, async () => {
  console.log(`API da agenda em http://localhost:${env.port}`);
  try {
    await getSettings(); // cria a configuracao inicial se ainda nao existir
  } catch (err) {
    console.error('Nao foi possivel ler as configuracoes:', err.message);
  }
});

async function shutdown(signal) {
  console.log(`\n${signal} recebido, encerrando...`);
  server.close(async () => {
    await disconnectPrisma();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
