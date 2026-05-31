import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';

// Use WebSockets only in Node.js environments (not Edge)
if (typeof WebSocket === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  neonConfig.webSocketConstructor = require('ws');
}

function createPrisma() {
  const connectionString = process.env.DATABASE_URL!;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaNeon(pool);
  return new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrisma();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Every route uses the single company in the database
export async function getCompanyId(): Promise<string> {
  const company = await prisma.company.findFirst();
  if (!company) throw new Error('No company found. Run database seed first.');
  return company.id;
}

export function ok(data: unknown, status = 200) {
  return Response.json({ success: true, data }, { status });
}
export function err(message: string, status = 500) {
  return Response.json({ success: false, error: message }, { status });
}
