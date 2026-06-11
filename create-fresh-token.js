import dotenv from 'dotenv';
dotenv.config({ override: true });
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function hashToken(token) {
  return bcrypt.hash(token, 10);
}

(async () => {
  try {
    // Generate fresh token
    const plainToken = generateResetToken();
    const hashedToken = await hashToken(plainToken);
    
    // Delete old tokens for this email
    await prisma.passwordReset.deleteMany({
      where: { email: 'cyberincognito15@gmail.com' }
    });
    
    // Create new token
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await prisma.passwordReset.create({
      data: {
        email: 'cyberincognito15@gmail.com',
        token: hashedToken,
        expiresAt,
      },
    });
    
    console.log('✅ Fresh reset token created!\n');
    console.log('Plain token:', plainToken);
    console.log('\n✅ Reset Link for testing:');
    console.log(`http://localhost:3000/reset-password.html?token=${plainToken}`);
    
  } finally {
    await prisma.$disconnect();
  }
})();
