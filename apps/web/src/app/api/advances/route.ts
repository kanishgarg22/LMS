import { NextRequest } from 'next/server';
import { prisma, getCompanyId, ok, err } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const companyId = await getCompanyId();
    const { searchParams } = new URL(req.url);
    const workerId = searchParams.get('workerId');
    const where: Record<string, unknown> = { companyId };
    if (workerId) where.workerId = workerId;

    const advances = await prisma.advance.findMany({
      where,
      include: { worker: { select: { id: true, fullName: true, phone: true } } },
      orderBy: { date: 'desc' },
    });
    return ok(advances);
  } catch (e) { return err(String(e)); }
}

export async function POST(req: NextRequest) {
  try {
    const companyId = await getCompanyId();
    const { workerId, amount, purpose, date } = await req.json();
    if (!workerId || !amount || !date) return err('workerId, amount, date required', 400);

    const advance = await prisma.advance.create({
      data: { workerId, amount: parseFloat(amount), purpose, date: new Date(date), companyId },
    });
    await prisma.payment.create({
      data: { workerId, type: 'ADVANCE', amount: parseFloat(amount), date: new Date(date), notes: purpose, companyId },
    });
    return ok(advance, 201);
  } catch (e) { return err(String(e)); }
}
