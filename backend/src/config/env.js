import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Carrega backend/.env pelo caminho do proprio arquivo, e nao pela pasta de
// onde o comando foi executado. Assim "npm start" funciona tanto de dentro
// de backend/ quanto da raiz do projeto.
// Em producao (Railway e afins) as variaveis ja vem do ambiente e este
// arquivo simplesmente nao existe — o dotenv ignora em silencio.
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(backendRoot, '.env') });

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`);
  }
  return value;
}

// Plataformas de hospedagem definem estas variaveis sozinhas. Se estamos
// rodando em uma delas, tratamos como producao mesmo que NODE_ENV nao tenha
// sido configurado — assim um esquecimento na hospedagem nao deixa o sistema
// no ar com as folgas do modo de desenvolvimento.
const hostedPlatform = Boolean(
  process.env.RAILWAY_ENVIRONMENT ||
    process.env.RAILWAY_PUBLIC_DOMAIN ||
    process.env.RENDER ||
    process.env.FLY_APP_NAME,
);

const nodeEnv = process.env.NODE_ENV ?? (hostedPlatform ? 'production' : 'development');
const production = nodeEnv === 'production' || hostedPlatform;

// Em producao o backend entrega o proprio frontend, entao tudo vem da mesma
// origem e nao existe requisicao cross-origin legitima para liberar.
// Em desenvolvimento o Vite roda em outra porta e precisa ser autorizado.
// Um CORS_ORIGIN explicito vence; vazio conta como nao definido.
const corsOrigin =
  process.env.CORS_ORIGIN?.trim() || (production ? false : 'http://localhost:5173');

export const env = {
  nodeEnv,
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL'),
  sessionSecret: required('SESSION_SECRET'),
  // PIN inicial usado somente quando o banco ainda nao tem configuracao.
  initialPin: process.env.ACCESS_PIN ?? '1234',
  // Duracao da sessao autenticada.
  sessionMaxAgeDays: Number(process.env.SESSION_DAYS ?? 7),
  corsOrigin,
};

export const isProduction = production;
