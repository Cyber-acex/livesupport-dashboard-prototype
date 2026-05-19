import { prisma, connectDatabase } from './db/database-prisma.js';

async function run() {
  try {
    await connectDatabase();
    const user = await prisma.user.findUnique({
      where: { email: 'support@livesupport.com' },
      select: { id: true, email: true, name: true }
    });
    console.log(JSON.stringify(user));
  } catch (e) {
    console.error('ERROR', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
