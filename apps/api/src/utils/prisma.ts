import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prismaBase: PrismaClient };

const baseClient =
  globalForPrisma.prismaBase ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

// In development keep the client alive across hot-reloads.
// In serverless (Vercel) we do NOT cache — each invocation gets a fresh connection.
if (process.env.NODE_ENV === 'development') {
  globalForPrisma.prismaBase = baseClient;
}

// Auto-retry once on Neon sleep-wake P1001 errors.
export const prisma = baseClient.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }: { args: unknown; query: (args: unknown) => Promise<unknown> }) {
        try {
          return await query(args);
        } catch (err: unknown) {
          const msg = (err as Error)?.message ?? '';
          if (msg.includes("Can't reach database server") || msg.includes('P1001')) {
            await new Promise(r => setTimeout(r, 3000));
            return await query(args);
          }
          throw err;
        }
      },
    },
  },
}) as unknown as PrismaClient;

// Keep-alive ping: only run in long-lived server mode (local dev / Railway).
// Never in serverless — would hold the Lambda open indefinitely.
if (process.env.NODE_ENV === 'development') {
  setInterval(async () => {
    try { await baseClient.$queryRaw`SELECT 1`; } catch { /* ignore */ }
  }, 4 * 60 * 1000);
}
