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
    console.log('🧪 Testing Password Reset Submission...\n');
    
    // 1. Generate a test token and store it
    const plainToken = generateResetToken();
    const hashedToken = await hashToken(plainToken);
    const testEmail = 'admin@livesupport.com';
    
    // Clear existing tokens for this user
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
    console.log('✅ Test token created:', plainToken.substring(0, 16) + '...\n');
    
    // Get original password
    const userBefore = await prisma.user.findUnique({ where: { email: testEmail } });
    console.log('Original password hash:', userBefore.password.substring(0, 20) + '...\n');
    
    // 2. Submit password reset request to API
    const newPassword = 'TestPassword@12345';
    console.log('Testing POST /api/auth/reset-password...');
    const resetRes = await fetch('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: plainToken,
        newPassword: newPassword,
        confirmPassword: newPassword,
      }),
    });
    
    const resetData = await resetRes.json();
    console.log('Response Status:', resetRes.status);
    console.log('Response:', JSON.stringify(resetData, null, 2));
    
    if (!resetData.success) {
      console.log('\n❌ Password reset failed!');
      await prisma.$disconnect();
      return;
    }
    
    console.log('\n✅ Reset request succeeded!\n');
    
    // 3. Verify password was updated
    const userAfter = await prisma.user.findUnique({ where: { email: testEmail } });
    console.log('New password hash:', userAfter.password.substring(0, 20) + '...');
    
    const passwordChanged = userBefore.password !== userAfter.password;
    console.log('Password changed:', passwordChanged ? '✅ YES' : '❌ NO');
    
    // 4. Verify password matches
    const passwordMatches = await bcrypt.compare(newPassword, userAfter.password);
    console.log('Password matches:', passwordMatches ? '✅ YES' : '❌ NO');
    
    // 5. Check if token is marked as used
    const usedToken = await prisma.passwordReset.findFirst({
      where: { email: testEmail },
      orderBy: { createdAt: 'desc' },
    });
    console.log('Token marked as used:', usedToken.usedAt ? '✅ YES' : '❌ NO');
    
    if (passwordChanged && passwordMatches) {
      console.log('\n🎉 Password Reset - SUCCESSFUL!');
    } else {
      console.log('\n❌ Password Reset - FAILED!');
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
})();
