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
  const user = await prisma.user.findUnique({
    where: { email: 'test@example.com' }
  });
  console.log('User found:', user);
  
  const allUsers = await prisma.user.findMany({
    select: { id: true, email: true, name: true },
    take: 5
  });
  console.log('All users:', allUsers);
  
  await prisma.$disconnect();
})();
