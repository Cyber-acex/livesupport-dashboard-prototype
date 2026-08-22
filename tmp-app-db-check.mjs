import 'dotenv/config';
import { prisma } from './db/database-prisma.js';

try {
  await prisma.$connect();
  const rows = await prisma.$queryRaw`SELECT 1 AS ok`;
  const branchCount = await prisma.branch.count();

  console.log('DB_CONNECT_OK');
  console.log(JSON.stringify(rows));
  console.log('BRANCH_COUNT=' + branchCount);
} catch (error) {
  console.error('DB_CONNECT_FAIL');
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
