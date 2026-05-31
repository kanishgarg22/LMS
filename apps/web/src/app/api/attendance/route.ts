import { NextRequest } from 'next/server';
import { prisma, getCompanyId, ok, err } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const companyId = await getCompanyId();
    const body = await req.json();
    const { workerId, date, status, overtime = 'NONE', overtimeHours, lateMinutes, halfDaySession } = body;

    if (!workerId || !date || !status) return err('workerId, date, status required', 400);

    const admin = await prisma.user.findFirst({ where: { companyId } });
    if (!admin) return err('No admin user found', 404);

    const parsedOT = overtimeHours ? parseFloat(String(overtimeHours)) : null;
    const parsedLT = lateMinutes  ? parseInt(String(lateMinutes),  10) : null;
    const safeOT   = parsedOT && !isNaN(parsedOT) && parsedOT > 0 ? parsedOT : null;
    const safeLT   = parsedLT && !isNaN(parsedLT) && parsedLT > 0 ? parsedLT : null;
    const safeSession = status === 'HALF_DAY' && (halfDaySession === 'M' || halfDaySession === 'E') ? halfDaySession : null;

    const attendance = await prisma.attendance.upsert({
      where: { workerId_date: { workerId, date: new Date(date) } },
      create: { workerId, date: new Date(date), status, overtime: safeOT ? 'OT' : overtime, overtimeHours: safeOT, lateMinutes: safeLT, halfDaySession: safeSession, markedById: admin.id, companyId },
      update: { status, overtime: safeOT ? 'OT' : overtime, overtimeHours: safeOT, lateMinutes: safeLT, halfDaySession: safeSession, markedById: admin.id },
    });

    return ok(attendance);
  } catch (e) { return err(String(e)); }
}
