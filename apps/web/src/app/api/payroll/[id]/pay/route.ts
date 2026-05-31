import { NextRequest } from 'next/server';
import { prisma, getCompanyId, ok, err } from '@/lib/db';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const companyId = await getCompanyId();
    const payroll = await prisma.payrollRecord.findFirst({ where: { id: params.id, companyId } });
    if (!payroll) return err('Payroll not found', 404);

    const updated = await prisma.payrollRecord.update({
      where: { id: params.id },
      data:  { isPaid: true, paidAt: new Date() },
    });

    await prisma.payment.create({
      data: {
        workerId: payroll.workerId, type: 'SALARY', amount: payroll.netSalary,
        date: new Date(), month: payroll.month, year: payroll.year,
        notes: `Salary paid for ${payroll.month}/${payroll.year}`, companyId,
      },
    });

    return ok(updated);
  } catch (e) { return err(String(e)); }
}
