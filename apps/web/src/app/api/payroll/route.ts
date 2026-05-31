import { NextRequest } from 'next/server';
import { prisma, getCompanyId, ok, err } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const companyId = await getCompanyId();
    const { searchParams } = new URL(req.url);
    const month = parseInt(searchParams.get('month') || '') || new Date().getMonth() + 1;
    const year  = parseInt(searchParams.get('year')  || '') || new Date().getFullYear();

    const payrolls = await prisma.payrollRecord.findMany({
      where: { companyId, month, year },
      include: { worker: true },
      orderBy: { worker: { fullName: 'asc' } },
    });
    return ok(payrolls);
  } catch (e) { return err(String(e)); }
}
