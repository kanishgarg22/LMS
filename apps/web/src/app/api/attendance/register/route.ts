import { NextRequest } from 'next/server';
import { prisma, getCompanyId, ok, err } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const companyId = await getCompanyId();
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '5');

    const dates: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }

    const [workers, attendances] = await Promise.all([
      prisma.worker.findMany({ where: { companyId, isActive: true }, orderBy: { fullName: 'asc' } }),
      prisma.attendance.findMany({
        where: { companyId, date: { gte: new Date(dates[0]), lte: new Date(dates[dates.length - 1] + 'T23:59:59') } },
      }),
    ]);

    const rows = workers.map(worker => {
      const attendance: Record<string, { id: string; status: string; overtime: string; overtimeHours: number | null; lateMinutes: number | null; halfDaySession: string | null } | null> = {};
      for (const date of dates) {
        const att = attendances.find(a => a.workerId === worker.id && a.date.toISOString().split('T')[0] === date);
        attendance[date] = att ? {
          id: att.id, status: att.status, overtime: att.overtime,
          overtimeHours:  att.overtimeHours  ? Number(att.overtimeHours)  : null,
          lateMinutes:    att.lateMinutes    ?? null,
          halfDaySession: att.halfDaySession ?? null,
        } : null;
      }
      return { worker, attendance };
    });

    return ok({ dates, rows });
  } catch (e) { return err(String(e)); }
}
