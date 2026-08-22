import 'dotenv/config';
import { prisma } from './db/database-prisma.js';

const branches = [
  { name: 'Ikeja', address: 'Ikeja', is_active: true, is_archived: false },
  { name: 'Lekki', address: 'Lekki', is_active: true, is_archived: false }
];

try {
  await prisma.$connect();

  for (const branch of branches) {
    const existing = await prisma.branch.findFirst({ where: { name: branch.name } });

    if (existing) {
      console.log('EXISTS ' + branch.name + ' id=' + existing.id);
      continue;
    }

    const created = await prisma.branch.create({ data: branch });
    console.log('CREATED ' + branch.name + ' id=' + created.id);
  }
} catch (error) {
  console.error('BRANCH_SEED_FAIL');
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
