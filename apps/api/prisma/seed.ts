import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const passwordHash = await bcrypt.hash('admin123', 12);

  const company = await prisma.company.upsert({
    where: { id: 'seed-company-id' },
    update: {},
    create: {
      id: 'seed-company-id',
      name: 'Sharma Construction',
      address: 'Mumbai, Maharashtra',
      phone: '9876543210',
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@sharma.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@sharma.com',
      passwordHash,
      role: 'ADMIN',
      companyId: company.id,
    },
  });

  const workers = [
    { fullName: 'Rahul Kumar',   phone: '9876543001', category: 'DAILY_WAGE'      as const, dailyWage: 600,   monthlySalary: null },
    { fullName: 'Aman Singh',    phone: '9876543002', category: 'DAILY_WAGE'      as const, dailyWage: 550,   monthlySalary: null },
    { fullName: 'Suresh Patel',  phone: '9876543003', category: 'MONTHLY_SALARY'  as const, dailyWage: null,  monthlySalary: 18000 },
    { fullName: 'Mohan Yadav',   phone: '9876543004', category: 'DAILY_WAGE'      as const, dailyWage: 650,   monthlySalary: null },
    { fullName: 'Rajesh Sharma', phone: '9876543005', category: 'MONTHLY_SALARY'  as const, dailyWage: null,  monthlySalary: 22000 },
  ];

  for (const w of workers) {
    await prisma.worker.upsert({
      where: { id: `seed-worker-${w.phone}` },
      update: {},
      create: {
        id: `seed-worker-${w.phone}`,
        fullName: w.fullName,
        phone: w.phone,
        address: 'Mumbai, Maharashtra',
        joiningDate: new Date('2024-01-01'),
        category: w.category,
        dailyWage: w.dailyWage,
        monthlySalary: w.monthlySalary,
        companyId: company.id,
      },
    });
  }

  console.log('✅ Seed complete!');
  console.log('📧 Login: admin@sharma.com / admin123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
