import { NextRequest } from 'next/server';
import { prisma, getCompanyId, ok, err } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const companyId = await getCompanyId();
    const { searchParams } = new URL(req.url);
    const search   = searchParams.get('search') || '';
    const isActive = searchParams.get('isActive');

    const where: Record<string, unknown> = { companyId };
    if (search) where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { phone:    { contains: search } },
    ];
    if (isActive !== null) where.isActive = isActive === 'true';

    const [workers, total] = await Promise.all([
      prisma.worker.findMany({ where, orderBy: { fullName: 'asc' } }),
      prisma.worker.count({ where }),
    ]);

    return Response.json({ success: true, data: workers, total });
  } catch (e) { return err(String(e)); }
}

export async function POST(req: NextRequest) {
  try {
    const companyId = await getCompanyId();
    const body = await req.json();
    const { fullName, phone, address, joiningDate, category, dailyWage, monthlySalary, notes, overtimeRate, lateChargeRate, lateChargeUnit } = body;
    if (!fullName || !phone || !joiningDate || !category) return err('fullName, phone, joiningDate, category required', 400);

    const worker = await prisma.worker.create({
      data: {
        fullName, phone, address,
        joiningDate: new Date(joiningDate), category,
        dailyWage:      dailyWage      ? parseFloat(dailyWage)      : null,
        monthlySalary:  monthlySalary  ? parseFloat(monthlySalary)  : null,
        overtimeRate:   overtimeRate   ? parseFloat(overtimeRate)   : null,
        lateChargeRate: lateChargeRate ? parseFloat(lateChargeRate) : null,
        lateChargeUnit: lateChargeUnit || 'PER_MINUTE',
        notes, companyId,
      },
    });
    return ok(worker, 201);
  } catch (e) { return err(String(e)); }
}
