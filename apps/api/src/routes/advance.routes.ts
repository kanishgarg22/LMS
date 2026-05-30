import { Router, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

export const advanceRouter = Router();
advanceRouter.use(authenticate);

// GET /api/advances
advanceRouter.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { workerId, isFullyRepaid } = req.query;
    const where: Record<string, unknown> = { companyId: req.user!.companyId };
    if (workerId) where.workerId = workerId;
    if (isFullyRepaid !== undefined) where.isFullyRepaid = isFullyRepaid === 'true';

    const advances = await prisma.advance.findMany({
      where,
      include: { worker: { select: { id: true, fullName: true, phone: true } } },
      orderBy: { date: 'desc' },
    });

    res.json({ success: true, data: advances });
  } catch (err) { next(err); }
});

// POST /api/advances
advanceRouter.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { workerId, amount, purpose, date } = req.body;
    if (!workerId || !amount || !date) {
      res.status(400).json({ success: false, error: 'workerId, amount, date required' });
      return;
    }

    const worker = await prisma.worker.findFirst({ where: { id: workerId, companyId: req.user!.companyId } });
    if (!worker) { res.status(404).json({ success: false, error: 'Worker not found' }); return; }

    const advance = await prisma.advance.create({
      data: {
        workerId,
        amount: parseFloat(amount),
        purpose,
        date: new Date(date),
        companyId: req.user!.companyId,
      },
    });

    await prisma.payment.create({
      data: {
        workerId,
        type: 'ADVANCE',
        amount: parseFloat(amount),
        date: new Date(date),
        notes: purpose,
        companyId: req.user!.companyId,
      },
    });

    res.status(201).json({ success: true, data: advance });
  } catch (err) { next(err); }
});

// POST /api/advances/:id/repay
advanceRouter.post('/:id/repay', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { amount } = req.body;
    if (!amount) { res.status(400).json({ success: false, error: 'amount required' }); return; }

    const advance = await prisma.advance.findFirst({ where: { id: req.params.id, companyId: req.user!.companyId } });
    if (!advance) { res.status(404).json({ success: false, error: 'Advance not found' }); return; }

    const newRepaid = Number(advance.repaidAmount) + parseFloat(amount);
    const isFullyRepaid = newRepaid >= Number(advance.amount);

    const updated = await prisma.advance.update({
      where: { id: req.params.id },
      data: { repaidAmount: newRepaid, isFullyRepaid },
    });

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});
