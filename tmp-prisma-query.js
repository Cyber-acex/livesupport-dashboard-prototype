import { PrismaClient } from './node_modules/.prisma/client/index.js';

const prisma = new PrismaClient();

(async () => {
  try {
    const staffs = await prisma.staff.findMany({
      select: { id: true, fullName: true, email: true, branch_id: true, role: true },
      orderBy: { id: 'asc' }
    });
    console.log('staffs:', JSON.stringify(staffs, null, 2));

    const branches = await prisma.branch.findMany({
      select: { id: true, name: true },
      orderBy: { id: 'asc' }
    });
    console.log('branches:', JSON.stringify(branches, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
})();
