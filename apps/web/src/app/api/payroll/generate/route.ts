import { NextRequest } from 'next/server';
import { prisma, getCompanyId, ok, err } from '@/lib/db';
import { calculatePayroll } from '@/lib/payroll';

export async function POST(req: NextRequest) {
  try {
    const companyId = await getCompanyId();
    const { month, year } = await req.json();
    if (!month || !year) return err('month and year required', 400);

    const workers = await prisma.worker.findMany({ where: { companyId, isActive: true } });
    const results = [];

    for (const worker of workers) {
      const start = new Date(year, month - 1, 1);
      const end   = new Date(year, month, 0, 23, 59, 59);

      const [attendances, pendingAdvances] = await Promise.all([
        prisma.attendance.findMany({ where: { workerId: worker.id, date: { gte: start, lte: end } } }),
        prisma.advance.findMany({ where: { workerId: worker.id, isFullyRepaid: false } }),
      ]);

      const totalPendingAdvance = pendingAdvances.reduce((s, a) => s + Number(a.amount) - Number(a.repaidAmount), 0);

      const calc = calculatePayroll({
        category:       worker.category,
        dailyWage:      worker.dailyWage      ? Number(worker.dailyWage)      : undefined,
        monthlySalary:  worker.monthlySalary  ? Number(worker.monthlySalary)  : undefined,
        joiningDate:    worker.joiningDate,
        month, year,
        attendances:    attendances.map(a => ({
          date: a.date, status: a.status, overtime: a.overtime,
          overtimeHours: a.overtimeHours ? Number(a.overtimeHours) : null,
          lateMinutes:   a.lateMinutes   ?? null,
        })),
        advances:       totalPendingAdvance,
        overtimeRate:   worker.overtimeRate   ? Number(worker.overtimeRate)   : undefined,
        lateChargeRate: worker.lateChargeRate ? Number(worker.lateChargeRate) : undefined,
        lateChargeUnit: worker.lateChargeUnit as 'PER_MINUTE' | 'PER_HOUR',
      });

      const payroll = await prisma.payrollRecord.upsert({
        where:   { workerId_month_year: { workerId: worker.id, month, year } },
        create:  { workerId: worker.id, month, year, companyId, ...calc },
        update:  calc,
        include: { worker: true },
      });
      results.push(payroll);
    }

    return ok(results);
  } catch (e) { return err(String(e)); }
}
