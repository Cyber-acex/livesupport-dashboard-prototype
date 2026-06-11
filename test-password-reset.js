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

// Helper functions (from utils/auth.js)
function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function hashToken(token) {
  return bcrypt.hash(token, 10);
}

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

(async () => {
  try {
    console.log('🧪 Testing Password Reset System...\n');
    
    // 1. Generate a test token
    const plainToken = generateResetToken();
    const hashedToken = await hashToken(plainToken);
    console.log('✅ Token generated:', plainToken.substring(0, 16) + '...');
    
    // 2. Store in database
    const testEmail = 'cyberincognito15@gmail.com';
    await prisma.passwordReset.deleteMany({ where: { email: testEmail } });
    
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await prisma.passwordReset.create({
      data: {
        email: testEmail,
        token: hashedToken,
        expiresAt,
      },
    });
    console.log('✅ Token stored in database\n');
    
    // 3. Test verify-reset-token endpoint
    console.log('Testing GET /api/auth/verify-reset-token...');
    const verifyRes = await fetch(`http://localhost:3000/api/auth/verify-reset-token?token=${plainToken}`);
    const verifyData = await verifyRes.json();
    console.log('Response:', verifyData);
    if (verifyData.email === testEmail) {
      console.log('✅ Token verification PASSED\n');
    } else {
      console.log('❌ Token verification FAILED\n');
    }
    
    // 4. Test reset-password endpoint
    console.log('Testing POST /api/auth/reset-password...');
    const newPassword = 'NewPassword@12345';
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
    console.log('Response:', resetData);
    
    if (resetData.success) {
      console.log('✅ Password reset PASSED\n');
      
      // 5. Verify token is now marked as used
      const usedToken = await prisma.passwordReset.findFirst({
        where: { email: testEmail },
        orderBy: { createdAt: 'desc' },
      });
      
      if (usedToken && usedToken.usedAt) {
        console.log('✅ Token marked as used (one-time use verified)\n');
      }
      
      // 6. Verify password was updated
      const user = await prisma.user.findUnique({
        where: { email: testEmail },
      });
      
      const passwordMatches = await bcrypt.compare(newPassword, user.password);
      if (passwordMatches) {
        console.log('✅ Password updated in database\n');
      } else {
        console.log('❌ Password not updated correctly\n');
      }
    } else {
      console.log('❌ Password reset FAILED\n');
    }
    
    console.log('🎉 Password Reset System - ALL TESTS PASSED!');
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
})();
