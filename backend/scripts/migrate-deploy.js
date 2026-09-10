/**
 * Aplica as migrations em producao.
 *
 * Migration precisa criar e alterar tabelas, coisa que o usuario da
 * aplicacao nao deve poder fazer no dia a dia. Entao, se existir uma
 * MIGRATION_DATABASE_URL (credencial administrativa), ela e usada aqui e
 * somente aqui; o servidor segue rodando com a DATABASE_URL restrita.
 *
 * Sem MIGRATION_DATABASE_URL configurada, cai no comportamento antigo e usa
 * a propria DATABASE_URL — que e o caso de quem ainda nao separou os usuarios.
 */
import { spawnSync } from 'node:child_process';

const migrationUrl = process.env.MIGRATION_DATABASE_URL?.trim();

const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  shell: true,
  env: migrationUrl ? { ...process.env, DATABASE_URL: migrationUrl } : process.env,
});

process.exit(result.status ?? 1);
