import express from 'express';
import { 
  generateResetToken, 
  hashToken, 
  verifyToken, 
  hashPassword, 
  validatePasswordStrength 
} from '../utils/auth.js';
import { 
  sendPasswordResetEmail, 
  sendPasswordChangedEmail 
} from '../utils/email.js';

// Factory function to create auth router with injected prisma instance
export function createAuthRouter(prisma) {
  const router = express.Router();

  // Rate limiting map: email -> { count, resetTime }
  const resetAttempts = new Map();
  const RATE_LIMIT_WINDOW = 3600000; // 1 hour
  const MAX_RESET_ATTEMPTS = 3;

  /**
   * POST /api/auth/forgot-password
   * Request password reset token
   */
  router.post('/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;

      if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        return res.status(400).json({ success: false, message: 'Valid email required' });
      }

      // Rate limiting
      const now = Date.now();
      const attempts = resetAttempts.get(email) || { count: 0, resetTime: now };

      if (now < attempts.resetTime) {
        if (attempts.count >= MAX_RESET_ATTEMPTS) {
          return res.status(429).json({ 
            success: false, 
            message: 'Too many reset requests. Try again later.' 
          });
        }
        attempts.count++;
      } else {
        attempts.count = 1;
        attempts.resetTime = now + RATE_LIMIT_WINDOW;
      }
      resetAttempts.set(email, attempts);

      // Check if user exists (without confirming to prevent email enumeration)
      const user = await prisma.user.findUnique({
        where: { email },
      });

      // Always return success message for security
      const successMessage = 'If an account exists with that email, a reset link has been sent.';

      if (!user) {
        console.log(`ℹ️ Password reset requested for non-existent email: ${email}`);
        return res.json({ success: true, message: successMessage });
      }

      // Delete any existing reset tokens for this user
      await prisma.passwordReset.deleteMany({
        where: { email },
      });

      // Generate reset token
      const plainToken = generateResetToken();
      const hashedToken = await hashToken(plainToken);

      // Store reset token in database (30 minutes expiration)
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      await prisma.passwordReset.create({
        data: {
          email,
          token: hashedToken,
          expiresAt,
        },
      });

      // Send reset email
      // Get the appropriate URL based on where request came from
      const getAppUrl = (req) => {
        const host = req.get('host');
        const protocol = req.protocol;
        
        // If ngrok or custom domain in host, use that
        if (host && (host.includes('ngrok') || host.includes('.'))) {
          return `${protocol}://${host}`;
        }
        
        // Otherwise use environment APP_URL
        return process.env.APP_URL || 'http://localhost:3000';
      };
      
      const baseUrl = getAppUrl(req);
      const resetLink = `${baseUrl}/reset-password.html?token=${plainToken}`;
      
      // Attempt to send email, but don't fail if email service is not configured
      try {
        const emailResult = await sendPasswordResetEmail(email, plainToken, resetLink);
        if (!emailResult.success) {
          console.warn(`⚠️ Email send warning for ${email}:`, emailResult.error);
          console.log(`🔗 Reset link (for testing): ${resetLink}`);
        } else {
          console.log(`✅ Password reset email sent to: ${email}`);
        }
      } catch (emailError) {
        console.warn(`⚠️ Failed to send email to ${email}:`, emailError.message);
        console.log(`🔗 Reset link (for testing): ${resetLink}`);
      }

      res.json({ success: true, message: successMessage });

    } catch (error) {
      console.error('❌ Forgot password error:', error.message);
      console.error('Stack:', error.stack);
      res.status(500).json({ 
        success: false, 
        message: 'Server error. Please try again.' 
      });
    }
  });

  /**
   * GET /api/auth/verify-reset-token
   * Verify if a reset token is valid
   */
  router.get('/verify-reset-token', async (req, res) => {
    try {
      const { token } = req.query;

      if (!token) {
        return res.status(400).json({ valid: false, message: 'Token required' });
      }

      // Find any valid reset token (since we hash them, we can't search directly)
      const resetRecords = await prisma.passwordReset.findMany({
        where: {
          usedAt: null, // Not yet used
          expiresAt: {
            gt: new Date(), // Not expired
          },
        },
      });

      // Check if token matches any record
      let validRecord = null;
      for (const record of resetRecords) {
        if (await verifyToken(token, record.token)) {
          validRecord = record;
          break;
        }
      }

      if (!validRecord) {
        return res.json({ valid: false, message: 'Invalid or expired token' });
      }

      res.json({ 
        valid: true, 
        email: validRecord.email,
        message: 'Token is valid' 
      });

    } catch (error) {
      console.error('❌ Verify token error:', error);
      res.status(500).json({ valid: false, message: 'Server error' });
    }
  });

  /**
   * POST /api/auth/reset-password
   * Reset password with valid token
   */
  router.post('/reset-password', async (req, res) => {
    try {
      const { token, newPassword, confirmPassword } = req.body;

      // Validate inputs
      if (!token || !newPassword || !confirmPassword) {
        return res.status(400).json({ 
          success: false, 
          message: 'Token and password required' 
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ 
          success: false, 
          message: 'Passwords do not match' 
        });
      }

      // Validate password strength
      const validation = validatePasswordStrength(newPassword);
      if (!validation.isValid) {
        return res.status(400).json({ 
          success: false, 
          message: 'Password does not meet requirements',
          errors: validation.errors 
        });
      }

      // Find and verify token
      const resetRecords = await prisma.passwordReset.findMany({
        where: {
          usedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      let validRecord = null;
      for (const record of resetRecords) {
        if (await verifyToken(token, record.token)) {
          validRecord = record;
          break;
        }
      }

      if (!validRecord) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid or expired token' 
        });
      }

      // Get user
      const user = await prisma.user.findUnique({
        where: { email: validRecord.email },
      });

      if (!user) {
        return res.status(404).json({ 
          success: false, 
          message: 'User not found' 
        });
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);

      // Update user password
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });

      // Mark token as used
      await prisma.passwordReset.update({
        where: { id: validRecord.id },
        data: { usedAt: new Date() },
      });

      // Send confirmation email
      await sendPasswordChangedEmail(user.email, user.name);

      // Invalidate all sessions for this user (force re-login on all devices)
      // This would require tracking sessions in a store (Redis/DB)
      console.log(`✅ Password reset successful for user: ${user.email}`);

      res.json({ 
        success: true, 
        message: 'Password has been reset successfully. Please log in with your new password.' 
      });

    } catch (error) {
      console.error('❌ Reset password error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Server error. Please try again.' 
      });
    }
  });

  return router;
}

export default createAuthRouter;
