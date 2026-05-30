import { Router, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

export const attendanceRouter = Router();
attendanceRouter.use(authenticate);

// GET /api/attendance/register?days=5 — Attendance register view
attendanceRouter.get('/register', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string) || 5;
    const targetDate = req.query.date as string | undefined;
    const companyId = req.user!.companyId;

    // Get date range: single date if `date` param provided, else last N days
    const dates: string[] = [];
    if (targetDate) {
      dates.push(targetDate);
    } else {
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
      }
    }

    const workers = await prisma.worker.findMany({
      where: { companyId, isActive: true },
      orderBy: { fullName: 'asc' },
    });

    const startDate = new Date(dates[0]);
    const endDate = new Date(dates[dates.length - 1]);
    endDate.setHours(23, 59, 59);

    const attendances = await prisma.attendance.findMany({
      where: {
        companyId,
        date: { gte: startDate, lte: endDate },
      },
    });

    // Build register rows
    const rows = workers.map(worker => {
      const attMap: Record<string, {
        id: string;
        status: string;
        overtime: string;
        overtimeHours:  number | null;
        lateMinutes:    number | null;
        halfDaySession: string | null;
      } | null> = {};

      for (const date of dates) {
        const att = attendances.find(
          a => a.workerId === worker.id && a.date.toISOString().split('T')[0] === date
        );
        attMap[date] = att ? {
          id: att.id,
          status: att.status,
          overtime: att.overtime,
          overtimeHours:  att.overtimeHours  ? Number(att.overtimeHours) : null,
          lateMinutes:    att.lateMinutes    ?? null,
          halfDaySession: att.halfDaySession ?? null,
        } : null;
      }

      return { worker, attendance: attMap };
    });

    res.json({ success: true, data: { dates, rows } });
  } catch (err) { next(err); }
});

// POST /api/attendance — Mark attendance
attendanceRouter.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { workerId, date, status, overtime = 'NONE', overtimeHours, lateMinutes, notes } = req.body;

    if (!workerId || !date || !status) {
      res.status(400).json({ success: false, error: 'workerId, date, status required' });
      return;
    }

    const validStatuses = ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'HOLIDAY', 'LEAVE'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ success: false, error: `Invalid status: ${status}` });
      return;
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      res.status(400).json({ success: false, error: `Invalid date: ${date}` });
      return;
    }

    // Parse optional numeric fields safely
    const parsedOT  = overtimeHours != null ? parseFloat(String(overtimeHours)) : null;
    const parsedLT  = lateMinutes  != null ? parseInt(String(lateMinutes), 10)  : null;
    const safeOT    = parsedOT != null && !isNaN(parsedOT) && parsedOT > 0 ? parsedOT : null;
    const safeLT    = parsedLT != null && !isNaN(parsedLT) && parsedLT > 0 ? parsedLT : null;
    const safeOTStr = safeOT ? 'OT' : (overtime === 'OT' ? 'NONE' : overtime);

    // halfDaySession: 'M' | 'E' | null — only relevant for HALF_DAY status
    const { halfDaySession } = req.body;
    const safeSession = status === 'HALF_DAY' && (halfDaySession === 'M' || halfDaySession === 'E')
      ? halfDaySession : null;

    const worker = await prisma.worker.findFirst({
      where: { id: workerId, companyId: req.user!.companyId },
    });
    if (!worker) { res.status(404).json({ success: false, error: 'Worker not found' }); return; }

    const attendance = await prisma.attendance.upsert({
      where: { workerId_date: { workerId, date: parsedDate } },
      create: {
        workerId,
        date: parsedDate,
        status,
        overtime: safeOTStr,
        overtimeHours: safeOT,
        lateMinutes:   safeLT,
        halfDaySession: safeSession,
        notes: notes || null,
        markedById: req.user!.userId,
        companyId: req.user!.companyId,
      },
      update: {
        status,
        overtime: safeOTStr,
        overtimeHours: safeOT,
        lateMinutes:   safeLT,
        halfDaySession: safeSession,
        notes: notes !== undefined ? notes : null,
        markedById: req.user!.userId,
      },
    });

    res.json({ success: true, data: attendance });
  } catch (err) { next(err); }
});

// POST /api/attendance/bulk — Mark multiple workers at once
attendanceRouter.post('/bulk', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { date, entries } = req.body;
    if (!date || !entries || !Array.isArray(entries)) {
      res.status(400).json({ success: false, error: 'date and entries array required' });
      return;
    }

    const results = await Promise.all(
      entries.map(async (entry: { workerId: string; status: string; overtime?: string; overtimeHours?: number }) => {
        const worker = await prisma.worker.findFirst({
          where: { id: entry.workerId, companyId: req.user!.companyId },
        });
        if (!worker) return null;

        return prisma.attendance.upsert({
          where: { workerId_date: { workerId: entry.workerId, date: new Date(date) } },
          create: {
            workerId: entry.workerId,
            date: new Date(date),
            status: entry.status as 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY',
            overtime: (entry.overtime || 'NONE') as 'NONE' | 'OT',
            overtimeHours: entry.overtimeHours || null,
            markedById: req.user!.userId,
            companyId: req.user!.companyId,
          },
          update: {
            status: entry.status as 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY',
            overtime: (entry.overtime || 'NONE') as 'NONE' | 'OT',
            overtimeHours: entry.overtimeHours || null,
          },
        });
      })
    );

    res.json({ success: true, data: results.filter(Boolean), count: results.filter(Boolean).length });
  } catch (err) { next(err); }
});

// GET /api/attendance/worker/:workerId?month=&year=
attendanceRouter.get('/worker/:workerId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { workerId } = req.params;
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const attendances = await prisma.attendance.findMany({
      where: {
        workerId,
        companyId: req.user!.companyId,
        date: { gte: start, lte: end },
      },
      orderBy: { date: 'asc' },
    });

    res.json({ success: true, data: attendances });
  } catch (err) { next(err); }
});

// GET /api/attendance/today — Today's attendance summary
attendanceRouter.get('/today', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [workers, todayAtt] = await Promise.all([
      prisma.worker.count({ where: { companyId: req.user!.companyId, isActive: true } }),
      prisma.attendance.findMany({
        where: {
          companyId: req.user!.companyId,
          date: { gte: today, lt: tomorrow },
        },
        include: { worker: true },
      }),
    ]);

    const stats = {
      total: workers,
      present: todayAtt.filter(a => a.status === 'PRESENT').length,
      absent: todayAtt.filter(a => a.status === 'ABSENT').length,
      late: todayAtt.filter(a => a.status === 'LATE').length,
      halfDay: todayAtt.filter(a => a.status === 'HALF_DAY').length,
      overtime: todayAtt.filter(a => a.overtime === 'OT').length,
      notMarked: workers - todayAtt.length,
    };

    res.json({ success: true, data: { stats, attendances: todayAtt } });
  } catch (err) { next(err); }
});

// DELETE /api/attendance/:id
attendanceRouter.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const att = await prisma.attendance.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    });
    if (!att) { res.status(404).json({ success: false, error: 'Attendance record not found' }); return; }

    await prisma.attendance.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Attendance deleted' });
  } catch (err) { next(err); }
});
