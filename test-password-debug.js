import dotenv from 'dotenv';
dotenv.config({ override: true });
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import fetch from 'node-fetch';

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
    console.log('🧪 Testing Password Reset with Specific Password...\n');
    
    // Setup
    const plainToken = generateResetToken();
    const hashedToken = await hashToken(plainToken);
    const testEmail = 'admin@livesupport.com';
    const testPassword = 'MySpecialPassword@123';
    
    // Clear and create token
    await prisma.passwordReset.deleteMany({ where: { email: testEmail } });
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await prisma.passwordReset.create({
      data: {
        email: testEmail,
        token: hashedToken,
        expiresAt,
      },
    });
    
    console.log('Test Data:');
    console.log('  Email:', testEmail);
    console.log('  Password to set:', testPassword);
    console.log('  Token:', plainToken.substring(0, 20) + '...\n');
    
    // Get original password
    const userBefore = await prisma.user.findUnique({ where: { email: testEmail } });
    console.log('Before:');
    console.log('  Password hash:', userBefore.password);
    console.log('  Password matches "MySpecialPassword@123"?', await bcrypt.compare('MySpecialPassword@123', userBefore.password));
    
    // Submit reset
    console.log('\nSending POST /api/auth/reset-password...');
    const response = await fetch('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: plainToken,
        newPassword: testPassword,
        confirmPassword: testPassword,
      }),
    });
    
    const data = await response.json();
    console.log('Response:', data, '\n');
    
    // Check result
    const userAfter = await prisma.user.findUnique({ where: { email: testEmail } });
    console.log('After:');
    console.log('  Password hash:', userAfter.password);
    console.log('  Password matches "MySpecialPassword@123"?', await bcrypt.compare('MySpecialPassword@123', userAfter.password));
    console.log('  Password matches "password123"?', await bcrypt.compare('password123', userAfter.password));
    console.log('  Password changed?', userBefore.password !== userAfter.password ? '✅ YES' : '❌ NO');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
})();
