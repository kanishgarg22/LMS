import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

export const workerRouter = Router();
workerRouter.use(authenticate);

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

// GET /api/workers
workerRouter.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { search, category, isActive, page = '1', limit = '50' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: Record<string, unknown> = { companyId: req.user!.companyId };
    if (search) where.OR = [
      { fullName: { contains: search as string, mode: 'insensitive' } },
      { phone: { contains: search as string } },
    ];
    if (category) where.category = category;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const [workers, total] = await Promise.all([
      prisma.worker.findMany({
        where,
        orderBy: { fullName: 'asc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.worker.count({ where }),
    ]);

    res.json({ success: true, data: workers, total, page: parseInt(page as string), totalPages: Math.ceil(total / parseInt(limit as string)) });
  } catch (err) { next(err); }
});

// GET /api/workers/:id
workerRouter.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const worker = await prisma.worker.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    });
    if (!worker) { res.status(404).json({ success: false, error: 'Worker not found' }); return; }
    res.json({ success: true, data: worker });
  } catch (err) { next(err); }
});

// POST /api/workers
workerRouter.post('/', upload.single('profilePhoto'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { fullName, phone, address, joiningDate, category, dailyWage, monthlySalary, notes, overtimeRate, lateChargeRate, lateChargeUnit } = req.body;
    if (!fullName || !phone || !joiningDate || !category) {
      res.status(400).json({ success: false, error: 'fullName, phone, joiningDate, category required' });
      return;
    }

    const worker = await prisma.worker.create({
      data: {
        fullName,
        phone,
        address,
        joiningDate: new Date(joiningDate),
        category,
        dailyWage: dailyWage ? parseFloat(dailyWage) : null,
        monthlySalary: monthlySalary ? parseFloat(monthlySalary) : null,
        overtimeRate: overtimeRate ? parseFloat(overtimeRate) : null,
        lateChargeRate: lateChargeRate ? parseFloat(lateChargeRate) : null,
        lateChargeUnit: lateChargeUnit || 'PER_MINUTE',
        profilePhoto: req.file ? `/uploads/${req.file.filename}` : null,
        notes,
        companyId: req.user!.companyId,
      },
    });

    res.status(201).json({ success: true, data: worker });
  } catch (err) { next(err); }
});

// PUT /api/workers/:id
workerRouter.put('/:id', upload.single('profilePhoto'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { fullName, phone, address, joiningDate, category, dailyWage, monthlySalary, notes, isActive, overtimeRate, lateChargeRate, lateChargeUnit } = req.body;

    const existing = await prisma.worker.findFirst({ where: { id: req.params.id, companyId: req.user!.companyId } });
    if (!existing) { res.status(404).json({ success: false, error: 'Worker not found' }); return; }

    const worker = await prisma.worker.update({
      where: { id: req.params.id },
      data: {
        fullName: fullName || existing.fullName,
        phone: phone || existing.phone,
        address: address !== undefined ? address : existing.address,
        joiningDate: joiningDate ? new Date(joiningDate) : existing.joiningDate,
        category: category || existing.category,
        dailyWage: dailyWage !== undefined ? parseFloat(dailyWage) : existing.dailyWage,
        monthlySalary: monthlySalary !== undefined ? parseFloat(monthlySalary) : existing.monthlySalary,
        overtimeRate: overtimeRate !== undefined ? (overtimeRate ? parseFloat(overtimeRate) : null) : existing.overtimeRate,
        lateChargeRate: lateChargeRate !== undefined ? (lateChargeRate ? parseFloat(lateChargeRate) : null) : existing.lateChargeRate,
        lateChargeUnit: lateChargeUnit || existing.lateChargeUnit,
        profilePhoto: req.file ? `/uploads/${req.file.filename}` : existing.profilePhoto,
        notes: notes !== undefined ? notes : existing.notes,
        isActive: isActive !== undefined ? isActive === 'true' : existing.isActive,
      },
    });

    res.json({ success: true, data: worker });
  } catch (err) { next(err); }
});

// DELETE /api/workers/:id
workerRouter.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.worker.findFirst({ where: { id: req.params.id, companyId: req.user!.companyId } });
    if (!existing) { res.status(404).json({ success: false, error: 'Worker not found' }); return; }

    await prisma.worker.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Worker deleted' });
  } catch (err) { next(err); }
});

// GET /api/workers/:id/account — Full account summary
workerRouter.get('/:id/account', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const worker = await prisma.worker.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
      include: {
        attendances: { orderBy: { date: 'desc' }, take: 90 },
        payrolls: { orderBy: [{ year: 'desc' }, { month: 'desc' }] },
        advances: { orderBy: { date: 'desc' } },
        payments: { orderBy: { date: 'desc' } },
      },
    });
    if (!worker) { res.status(404).json({ success: false, error: 'Worker not found' }); return; }

    const totalPaid = worker.payments
      .filter(p => p.type === 'SALARY')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const totalAdvances = worker.advances.reduce((sum, a) => sum + Number(a.amount), 0);
    const totalRepaid = worker.advances.reduce((sum, a) => sum + Number(a.repaidAmount), 0);
    const pendingAdvances = totalAdvances - totalRepaid;

    const pendingSalaries = worker.payrolls
      .filter(p => !p.isPaid)
      .reduce((sum, p) => sum + Number(p.netSalary), 0);

    res.json({
      success: true,
      data: {
        worker,
        summary: {
          totalPaid,
          totalAdvances,
          pendingAdvances,
          pendingSalaries,
          totalPayrolls: worker.payrolls.length,
        },
      },
    });
  } catch (err) { next(err); }
});
