/**
 * Liga/desliga o PostgreSQL local de desenvolvimento criado em backend/.pgdata.
 *
 *   node scripts/db-control.js start
 *   node scripts/db-control.js stop
 *   node scripts/db-control.js status
 *
 * So e necessario para o banco de desenvolvimento proprio deste projeto
 * (porta 5433). Um Postgres instalado como servico do Windows, ou um banco
 * na nuvem, nao precisa disso.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(here, '..');
const dataDir = path.join(backendDir, '.pgdata');
const logFile = path.join(backendDir, '.pgdata.log');

// Caminhos comuns de instalacao do PostgreSQL no Windows. O primeiro que
// existir e usado; se nenhum existir, tenta usar "pg_ctl" direto do PATH.
const candidates = [
  'C:\\Program Files\\PostgreSQL\\17\\bin',
  'C:\\Program Files\\PostgreSQL\\16\\bin',
  'C:\\Program Files\\PostgreSQL\\15\\bin',
];

function findPgCtl() {
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'pg_ctl.exe'))) return path.join(dir, 'pg_ctl.exe');
  }
  return 'pg_ctl'; // assume que esta no PATH
}

const action = process.argv[2];
if (!['start', 'stop', 'status'].includes(action)) {
  console.error('Uso: node scripts/db-control.js <start|stop|status>');
  process.exit(1);
}

const pgCtl = findPgCtl();
const args = ['-D', dataDir];
if (action === 'start') args.push('-l', logFile, '-o', '-p 5433', 'start');
else args.push(action);

const result = spawnSync(pgCtl, args, { stdio: 'inherit' });
process.exit(result.status ?? 1);
