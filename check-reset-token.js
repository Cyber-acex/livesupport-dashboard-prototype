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
  const tokens = await prisma.passwordReset.findMany({
    where: { email: 'test@example.com' },
    orderBy: { createdAt: 'desc' },
    take: 1
  });
  console.log(JSON.stringify(tokens, null, 2));
  await prisma.$disconnect();
})();
