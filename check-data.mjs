import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const branches = await prisma.branch.findMany();
    console.log('Branches:', branches);
    
    const staffs = await prisma.staff.findMany({ include: { branch: true } });
    console.log('Staff:', staffs);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
