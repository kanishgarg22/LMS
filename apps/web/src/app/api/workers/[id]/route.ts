import { NextRequest } from 'next/server';
import { prisma, getCompanyId, ok, err } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const companyId = await getCompanyId();
    const worker = await prisma.worker.findFirst({ where: { id: params.id, companyId } });
    if (!worker) return err('Worker not found', 404);
    return ok(worker);
  } catch (e) { return err(String(e)); }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const companyId = await getCompanyId();
    const existing = await prisma.worker.findFirst({ where: { id: params.id, companyId } });
    if (!existing) return err('Worker not found', 404);

    const body = await req.json();
    const { fullName, phone, address, joiningDate, category, dailyWage, monthlySalary, notes, isActive, overtimeRate, lateChargeRate, lateChargeUnit } = body;

    const worker = await prisma.worker.update({
      where: { id: params.id },
      data: {
        fullName:       fullName       || existing.fullName,
        phone:          phone          || existing.phone,
        address:        address        !== undefined ? address        : existing.address,
        joiningDate:    joiningDate    ? new Date(joiningDate)         : existing.joiningDate,
        category:       category       || existing.category,
        dailyWage:      dailyWage      !== undefined ? (dailyWage      ? parseFloat(dailyWage)      : null) : existing.dailyWage,
        monthlySalary:  monthlySalary  !== undefined ? (monthlySalary  ? parseFloat(monthlySalary)  : null) : existing.monthlySalary,
        overtimeRate:   overtimeRate   !== undefined ? (overtimeRate   ? parseFloat(overtimeRate)   : null) : existing.overtimeRate,
        lateChargeRate: lateChargeRate !== undefined ? (lateChargeRate ? parseFloat(lateChargeRate) : null) : existing.lateChargeRate,
        lateChargeUnit: lateChargeUnit || existing.lateChargeUnit,
        notes:          notes          !== undefined ? notes           : existing.notes,
        isActive:       isActive       !== undefined ? Boolean(isActive) : existing.isActive,
      },
    });
    return ok(worker);
  } catch (e) { return err(String(e)); }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const companyId = await getCompanyId();
    const existing = await prisma.worker.findFirst({ where: { id: params.id, companyId } });
    if (!existing) return err('Worker not found', 404);
    await prisma.worker.delete({ where: { id: params.id } });
    return ok({ message: 'Deleted' });
  } catch (e) { return err(String(e)); }
}
