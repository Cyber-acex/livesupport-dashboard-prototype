import nodemailer from 'nodemailer';
import 'dotenv/config';

// Lazy-load email transporter to ensure env vars are available
let transporter = null;
function getTransporter() {
  if (!transporter) {
    const config = {
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    };

    // Prefer explicit SMTP settings if provided.
    // This avoids relying on nodemailer service heuristics.
    if (process.env.SMTP_HOST && process.env.SMTP_HOST.trim()) {
      config.host = process.env.SMTP_HOST;
      config.port = parseInt(process.env.SMTP_PORT || '465', 10);
      config.secure = process.env.SMTP_SECURE === 'true';
    } else if (process.env.EMAIL_SERVICE && process.env.EMAIL_SERVICE.trim()) {
      config.service = process.env.EMAIL_SERVICE;
    }

    transporter = nodemailer.createTransport(config);

    transporter.verify().then(() => {
      console.log('✅ Email transporter verified and ready');
    }).catch((error) => {
      console.warn('⚠️ Email transporter verification failed:', error.message);
    });
  }
  return transporter;
}

/**
 * Send password reset email
 * @param {string} email - User's email address
 * @param {string} resetToken - Reset token
 * @param {string} resetLink - Full reset link URL
 */
export async function sendPasswordResetEmail(email, resetToken, resetLink) {
  try {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>Hello,</p>
        <p>You requested to reset your password. Click the link below to proceed:</p>
        
        <div style="margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Reset Password
          </a>
        </div>
        
        <p>Or copy this link:</p>
        <p style="background-color: #f0f0f0; padding: 10px; word-break: break-all;">${resetLink}</p>
        
        <p><strong>This link will expire in 30 minutes.</strong></p>
        
        <p>If you didn't request this, please ignore this email.</p>
        
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
        <p style="font-size: 12px; color: #666;">LiveSupport Team</p>
      </div>
    `;

    const mailOptions = {
      from: `LiveSupport <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset Request - LiveSupport',
      html: htmlContent,
      replyTo: process.env.EMAIL_USER,
      headers: {
        'X-Priority': '3',
        'X-Mailer': 'LiveSupport Email System',
      },
    };

    const result = await getTransporter().sendMail(mailOptions);
    console.log('✅ Password reset email sent to:', email);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ Failed to send password reset email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send password changed confirmation email
 * @param {string} email - User's email address
 * @param {string} userName - User's name
 */
export async function sendPasswordChangedEmail(email, userName) {
  try {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Changed Successfully</h2>
        <p>Hello ${userName},</p>
        <p>Your password has been successfully changed.</p>
        
        <p><strong>If you didn't make this change, please contact support immediately.</strong></p>
        
        <div style="margin: 30px 0;">
          <a href="${process.env.APP_URL}/login" style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Sign In
          </a>
        </div>
        
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
        <p style="font-size: 12px; color: #666;">LiveSupport Team</p>
      </div>
    `;

    const mailOptions = {
      from: `LiveSupport <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Changed - LiveSupport',
      html: htmlContent,
      replyTo: process.env.EMAIL_USER,
      headers: {
        'X-Priority': '3',
        'X-Mailer': 'LiveSupport Email System',
      },
    };

    const result = await getTransporter().sendMail(mailOptions);
    console.log('✅ Password changed confirmation email sent to:', email);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ Failed to send password changed email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send a custom message via email
 */
export async function sendEmail({ to, subject, text, html, from = process.env.EMAIL_USER }) {
  try {
    if (!to || !subject) {
      return { success: false, error: 'Missing recipient or subject' };
    }

    // Format "From" header with display name to improve deliverability
    const fromDisplay = `LiveSupport <${process.env.EMAIL_USER}>`;

    const mailOptions = {
      from: from === process.env.EMAIL_USER ? fromDisplay : from,
      to,
      subject,
      text: text || undefined,
      html: html || undefined,
      replyTo: process.env.EMAIL_USER, // Allow customers to reply easily
      headers: {
        'X-Priority': '3', // Normal priority
        'X-Mailer': 'LiveSupport Email System',
        'List-Unsubscribe': `<mailto:${process.env.EMAIL_USER}?subject=unsubscribe>`, // Helps with spam filtering
      },
    };

    const result = await getTransporter().sendMail(mailOptions);
    console.log('✅ Email sent to:', to, 'subject:', subject);
    return { success: true, messageId: result.messageId, envelope: result.envelope };
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Test email connection
 */
export async function testEmailConnection() {
  try {
    await transporter.verify();
    console.log('✅ Email service configured successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Email service configuration error:', error);
    return { success: false, error: error.message };
  }
}
