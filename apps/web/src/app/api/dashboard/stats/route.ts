import { prisma, getCompanyId, ok, err } from '@/lib/db';

export async function GET() {
  try {
    const companyId = await getCompanyId();
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const month = today.getMonth() + 1, year = today.getFullYear();

    const [activeWorkers, todayAtt, pendingPayrolls, pendingAdvances] = await Promise.all([
      prisma.worker.count({ where: { companyId, isActive: true } }),
      prisma.attendance.findMany({ where: { companyId, date: { gte: today, lt: tomorrow } } }),
      prisma.payrollRecord.findMany({ where: { companyId, isPaid: false } }),
      prisma.advance.findMany({ where: { companyId, isFullyRepaid: false } }),
    ]);

    const monthlyPayrolls = await prisma.payrollRecord.findMany({ where: { companyId, month, year } });

    return ok({
      activeWorkers,
      presentToday:   todayAtt.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length,
      absentToday:    todayAtt.filter(a => a.status === 'ABSENT').length,
      lateToday:      todayAtt.filter(a => a.status === 'LATE').length,
      pendingSalaries: pendingPayrolls.reduce((s, p) => s + Number(p.netSalary), 0),
      monthlyExpense:  monthlyPayrolls.reduce((s, p) => s + Number(p.netSalary), 0),
      totalAdvances:   pendingAdvances.reduce((s, a) => s + Number(a.amount) - Number(a.repaidAmount), 0),
      notMarkedToday:  activeWorkers - todayAtt.length,
    });
  } catch (e) { return err(String(e)); }
}
