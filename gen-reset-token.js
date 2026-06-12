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
    const plainToken = generateResetToken();
    const hashedToken = await hashToken(plainToken);
    const testEmail = 'admin@livesupport.com';
    
    // Clear existing tokens
    await prisma.passwordReset.deleteMany({ where: { email: testEmail } });
    
    // Create new token
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await prisma.passwordReset.create({
      data: {
        email: testEmail,
        token: hashedToken,
        expiresAt,
      },
    });
    
    console.log('\n✅ Test Token Generated!\n');
    console.log('Email:', testEmail);
    console.log('Token:', plainToken);
    console.log('\n🔗 Reset Link:');
    console.log(`http://localhost:3000/reset-password.html?token=${plainToken}\n`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
})();
