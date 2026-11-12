import { PrismaClient } from '@prisma/client';
import { prepareDatabaseEnv } from '../config/databaseEnv.js';

prepareDatabaseEnv();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Один клиент на прогретый экземпляр функции: так пул Neon не раздувается.
export const prisma = globalForPrisma.prisma ?? new PrismaClient();

globalForPrisma.prisma = prisma;
