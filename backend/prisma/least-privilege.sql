-- =====================================================================
-- Usuario de banco com o minimo de permissao para a aplicacao rodar.
--
-- Por padrao a aplicacao conecta com o usuario dono do banco, que costuma
-- ser superusuario. Se essa credencial vazar, o estrago vai muito alem de
-- ler a agenda: da para criar usuarios, apagar bancos e usar comandos
-- administrativos do Postgres.
--
-- Este script cria um usuario que so consegue ler e escrever nas tabelas da
-- aplicacao. Ele NAO consegue criar ou apagar tabelas, entao as migrations
-- continuam sendo aplicadas com a credencial administrativa, atraves da
-- variavel MIGRATION_DATABASE_URL (veja o README).
--
-- Como usar:
--   1. troque a senha abaixo por uma senha forte e unica;
--   2. rode este script conectado como o usuario administrativo do banco;
--   3. no ambiente da aplicacao, aponte:
--        DATABASE_URL           -> usuario agenda_app (este aqui)
--        MIGRATION_DATABASE_URL -> usuario administrativo (o de antes)
-- =====================================================================

-- 1. O usuario da aplicacao.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agenda_app') THEN
    CREATE ROLE agenda_app LOGIN PASSWORD 'TROQUE_ESTA_SENHA';
  END IF;
END
$$;

-- Sem poderes administrativos, de forma explicita.
ALTER ROLE agenda_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

-- 2. Pode entrar no banco e enxergar o schema, mas nao criar objetos nele.
GRANT CONNECT ON DATABASE agenda TO agenda_app;
GRANT USAGE ON SCHEMA public TO agenda_app;
REVOKE CREATE ON SCHEMA public FROM agenda_app;

-- 3. Leitura e escrita apenas nas tabelas da aplicacao.
GRANT SELECT, INSERT, UPDATE, DELETE ON clients, appointments, settings TO agenda_app;

-- A tabela de controle das migrations e so de leitura para a aplicacao:
-- o Prisma a consulta ao iniciar, mas quem escreve nela e a migration.
GRANT SELECT ON _prisma_migrations TO agenda_app;

-- 4. Tabelas criadas por migrations futuras ja nascem com a permissao certa.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO agenda_app;

-- 5. Conferencia. Deve mostrar todas as colunas de poder como "f" (false).
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
FROM pg_roles
WHERE rolname = 'agenda_app';
