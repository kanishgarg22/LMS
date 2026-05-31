import { prisma, err } from '@/lib/db';
import { NextRequest } from 'next/server';

export async function POST(_req: NextRequest) {
  try {
    const company = await prisma.company.findFirst();
    const user    = company ? await prisma.user.findFirst({ where: { companyId: company.id } }) : null;
    if (!company || !user) return err('No company found', 404);
    return Response.json({
      success: true,
      data: {
        token: 'local',
        user:    { id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.companyId },
        company: { id: company.id, name: company.name, logo: company.logo },
      },
    });
  } catch (e) { return err(String(e)); }
}
