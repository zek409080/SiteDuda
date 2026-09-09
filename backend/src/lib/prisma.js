import { PrismaClient } from '@prisma/client';
import { isProduction } from '../config/env.js';

// Cliente unico do Prisma. Ele monta consultas parametrizadas,
// o que evita SQL injection sem trabalho extra nas rotas.
export const prisma = new PrismaClient({
  log: isProduction ? ['error'] : ['error', 'warn'],
});

export async function disconnectPrisma() {
  await prisma.$disconnect();
}
