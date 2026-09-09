import 'dotenv/config';

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL'),
  sessionSecret: required('SESSION_SECRET'),
  // PIN inicial usado somente quando o banco ainda nao tem configuracao.
  initialPin: process.env.ACCESS_PIN ?? '1234',
  // Duracao da sessao autenticada.
  sessionMaxAgeDays: Number(process.env.SESSION_DAYS ?? 7),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
};

export const isProduction = env.nodeEnv === 'production';
