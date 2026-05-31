import { NextRequest } from 'next/server';
import { prisma, getCompanyId, ok, err } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const companyId = await getCompanyId();
    const { searchParams } = new URL(req.url);
    const month = parseInt(searchParams.get('month') || '') || new Date().getMonth() + 1;
    const year  = parseInt(searchParams.get('year')  || '') || new Date().getFullYear();

    const payrolls = await prisma.payrollRecord.findMany({ where: { companyId, month, year } });
    return ok({
      totalWorkers:  payrolls.length,
      totalNet:      payrolls.reduce((s, p) => s + Number(p.netSalary), 0),
      totalPaid:     payrolls.filter(p => p.isPaid).reduce((s, p) => s + Number(p.netSalary), 0),
      totalPending:  payrolls.filter(p => !p.isPaid).reduce((s, p) => s + Number(p.netSalary), 0),
      paidCount:     payrolls.filter(p => p.isPaid).length,
      pendingCount:  payrolls.filter(p => !p.isPaid).length,
    });
  } catch (e) { return err(String(e)); }
}
