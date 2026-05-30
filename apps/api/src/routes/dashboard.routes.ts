import { Router, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

export const dashboardRouter = Router();
dashboardRouter.use(authenticate);

// GET /api/dashboard/stats
dashboardRouter.get('/stats', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const companyId = req.user!.companyId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    const [
      totalWorkers,
      activeWorkers,
      todayAtt,
      pendingPayrolls,
      monthlyPayrolls,
      pendingAdvances,
    ] = await Promise.all([
      prisma.worker.count({ where: { companyId } }),
      prisma.worker.count({ where: { companyId, isActive: true } }),
      prisma.attendance.findMany({
        where: { companyId, date: { gte: today, lt: tomorrow } },
      }),
      prisma.payrollRecord.findMany({
        where: { companyId, isPaid: false },
      }),
      prisma.payrollRecord.findMany({
        where: { companyId, month, year },
      }),
      prisma.advance.findMany({
        where: { companyId, isFullyRepaid: false },
      }),
    ]);

    const stats = {
      totalWorkers,
      activeWorkers,
      presentToday: todayAtt.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length,
      absentToday: todayAtt.filter(a => a.status === 'ABSENT').length,
      lateToday: todayAtt.filter(a => a.status === 'LATE').length,
      overtimeToday: todayAtt.filter(a => a.overtime === 'OT').length,
      pendingSalaries: pendingPayrolls.reduce((s, p) => s + Number(p.netSalary), 0),
      pendingCount: pendingPayrolls.length,
      monthlyExpense: monthlyPayrolls.reduce((s, p) => s + Number(p.netSalary), 0),
      totalAdvances: pendingAdvances.reduce(
        (s, a) => s + (Number(a.amount) - Number(a.repaidAmount)),
        0
      ),
      notMarkedToday: activeWorkers - todayAtt.length,
    };

    res.json({ success: true, data: stats });
  } catch (err) { next(err); }
});

// GET /api/dashboard/trends?days=7
dashboardRouter.get('/trends', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const companyId = req.user!.companyId;

    const trends: Array<{ date: string; present: number; absent: number; late: number; halfDay: number; overtime: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const atts = await prisma.attendance.findMany({
        where: { companyId, date: { gte: date, lt: nextDate } },
      });

      trends.push({
        date: date.toISOString().split('T')[0],
        present: atts.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length,
        absent: atts.filter(a => a.status === 'ABSENT').length,
        late: atts.filter(a => a.status === 'LATE').length,
        halfDay: atts.filter(a => a.status === 'HALF_DAY').length,
        overtime: atts.filter(a => a.overtime === 'OT').length,
      });
    }

    res.json({ success: true, data: trends });
  } catch (err) { next(err); }
});

// GET /api/dashboard/monthly-expense?months=6
dashboardRouter.get('/monthly-expense', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const months = parseInt(req.query.months as string) || 6;
    const companyId = req.user!.companyId;
    const result: Array<{ month: number; year: number; label: string; totalExpense: number; workerCount: number }> = [];

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();

      const payrolls = await prisma.payrollRecord.findMany({
        where: { companyId, month: m, year: y },
      });

      result.push({
        month: m,
        year: y,
        label: `${d.toLocaleString('default', { month: 'short' })} ${y}`,
        totalExpense: payrolls.reduce((s, p) => s + Number(p.netSalary), 0),
        workerCount: payrolls.length,
      });
    }

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});
