import dotenv from 'dotenv';
dotenv.config({ override: true });
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

(async () => {
  const token = await prisma.passwordReset.findFirst({
    where: { email: 'admin@livesupport.com' },
    orderBy: { createdAt: 'desc' }
  });
  console.log('Reset token record:', JSON.stringify(token, null, 2));
  await prisma.$disconnect();
})();
