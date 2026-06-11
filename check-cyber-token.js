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
    where: { email: 'cyberincognito15@gmail.com' },
    orderBy: { createdAt: 'desc' }
  });
  console.log('Reset token record:', JSON.stringify(token, null, 2));
  
  if (token) {
    console.log('\n✅ Reset Link for testing:');
    console.log(`http://localhost:3000/reset-password.html?token=${token.token}`);
  }
  
  await prisma.$disconnect();
})();
