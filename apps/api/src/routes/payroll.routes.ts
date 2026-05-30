import { Router, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { calculatePayroll } from '../utils/payroll';

export const payrollRouter = Router();
payrollRouter.use(authenticate);

// GET /api/payroll?month=&year=
payrollRouter.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    const payrolls = await prisma.payrollRecord.findMany({
      where: { companyId: req.user!.companyId, month, year },
      include: { worker: true },
      orderBy: { worker: { fullName: 'asc' } },
    });

    res.json({ success: true, data: payrolls });
  } catch (err) { next(err); }
});

// POST /api/payroll/generate — Auto-generate payroll for a month
payrollRouter.post('/generate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { month, year } = req.body;
    if (!month || !year) {
      res.status(400).json({ success: false, error: 'month and year required' });
      return;
    }

    const workers = await prisma.worker.findMany({
      where: { companyId: req.user!.companyId, isActive: true },
    });

    const results: unknown[] = [];

    for (const worker of workers) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);

      const [attendances, pendingAdvances] = await Promise.all([
        prisma.attendance.findMany({
          where: { workerId: worker.id, date: { gte: start, lte: end } },
        }),
        prisma.advance.findMany({
          where: { workerId: worker.id, isFullyRepaid: false },
        }),
      ]);

      const totalPendingAdvance = pendingAdvances.reduce(
        (sum, a) => sum + Number(a.amount) - Number(a.repaidAmount),
        0
      );

      const calc = calculatePayroll({
        category: worker.category,
        dailyWage: worker.dailyWage ? Number(worker.dailyWage) : undefined,
        monthlySalary: worker.monthlySalary ? Number(worker.monthlySalary) : undefined,
        joiningDate: worker.joiningDate,
        month,
        year,
        attendances: attendances.map(a => ({
          date: a.date,
          status: a.status,
          overtime: a.overtime,
          overtimeHours: a.overtimeHours ? Number(a.overtimeHours) : null,
          lateMinutes: a.lateMinutes ?? null,
        })),
        advances: totalPendingAdvance,
        overtimeRate: worker.overtimeRate ? Number(worker.overtimeRate) : undefined,
        lateChargeRate: worker.lateChargeRate ? Number(worker.lateChargeRate) : undefined,
        lateChargeUnit: worker.lateChargeUnit,
      });

      const payroll = await prisma.payrollRecord.upsert({
        where: { workerId_month_year: { workerId: worker.id, month, year } },
        create: {
          workerId: worker.id,
          month,
          year,
          companyId: req.user!.companyId,
          ...calc,
        },
        update: calc,
        include: { worker: true },
      });

      results.push(payroll);
    }

    res.json({ success: true, data: results, count: results.length });
  } catch (err) { next(err); }
});

// GET /api/payroll/worker/:workerId
payrollRouter.get('/worker/:workerId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const payrolls = await prisma.payrollRecord.findMany({
      where: { workerId: req.params.workerId, companyId: req.user!.companyId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    res.json({ success: true, data: payrolls });
  } catch (err) { next(err); }
});

// POST /api/payroll/:id/pay — Mark as paid
payrollRouter.post('/:id/pay', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const payroll = await prisma.payrollRecord.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    });
    if (!payroll) { res.status(404).json({ success: false, error: 'Payroll not found' }); return; }

    const updated = await prisma.payrollRecord.update({
      where: { id: req.params.id },
      data: { isPaid: true, paidAt: new Date() },
    });

    await prisma.payment.create({
      data: {
        workerId: payroll.workerId,
        type: 'SALARY',
        amount: payroll.netSalary,
        date: new Date(),
        month: payroll.month,
        year: payroll.year,
        notes: `Salary paid for ${payroll.month}/${payroll.year}`,
        companyId: req.user!.companyId,
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// GET /api/payroll/summary?month=&year= — Monthly summary
payrollRouter.get('/summary', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    const payrolls = await prisma.payrollRecord.findMany({
      where: { companyId: req.user!.companyId, month, year },
    });

    const summary = {
      totalWorkers: payrolls.length,
      totalBasic: payrolls.reduce((s, p) => s + Number(p.basicSalary), 0),
      totalOvertime: payrolls.reduce((s, p) => s + Number(p.overtimePay), 0),
      totalDeductions: payrolls.reduce((s, p) => s + Number(p.advanceDeduction), 0),
      totalNet: payrolls.reduce((s, p) => s + Number(p.netSalary), 0),
      totalPaid: payrolls.filter(p => p.isPaid).reduce((s, p) => s + Number(p.netSalary), 0),
      totalPending: payrolls.filter(p => !p.isPaid).reduce((s, p) => s + Number(p.netSalary), 0),
      paidCount: payrolls.filter(p => p.isPaid).length,
      pendingCount: payrolls.filter(p => !p.isPaid).length,
    };

    res.json({ success: true, data: summary });
  } catch (err) { next(err); }
});
