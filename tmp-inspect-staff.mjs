import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
try {
  const staff = await prisma.staff.findFirst({
    where: { email: 'cyberincognito15@gmail.com' },
    include: { branch: true }
  });
  console.log(JSON.stringify(staff, null, 2));
} finally {
  await prisma.$disconnect();
}
