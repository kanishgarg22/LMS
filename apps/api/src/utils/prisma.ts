import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prismaBase: PrismaClient };

const baseClient =
  globalForPrisma.prismaBase ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prismaBase = baseClient;

// Auto-retry once on Neon sleep-wake P1001 errors.
// Correct Prisma 5 syntax: query.$allModels.$allOperations
export const prisma = baseClient.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }: { args: unknown; query: (args: unknown) => Promise<unknown> }) {
        try {
          return await query(args);
        } catch (err: unknown) {
          const msg = (err as Error)?.message ?? '';
          if (msg.includes("Can't reach database server") || msg.includes('P1001')) {
            await new Promise(r => setTimeout(r, 3000)); // wait for Neon to wake
            return await query(args);
          }
          throw err;
        }
      },
    },
  },
}) as unknown as PrismaClient;

// Keep-alive ping every 4 min so Neon never goes to sleep during an active session
setInterval(async () => {
  try { await baseClient.$queryRaw`SELECT 1`; } catch { /* ignore */ }
}, 4 * 60 * 1000);
