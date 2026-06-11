# Forgot Password System - Setup & Configuration Guide

## Overview
A complete forgot password system has been implemented for LiveSupport. Users can securely reset their passwords through email-based reset links with token verification, rate limiting, and password strength validation.

## Files Created/Modified

### Backend Files
1. **utils/auth.js** - Authentication utilities
   - `generateResetToken()` - Generates secure random tokens
   - `hashToken()` - Hashes tokens for storage
   - `verifyToken()` - Verifies plain tokens against hashes
   - `hashPassword()` - Hashes passwords with bcryptjs
   - `validatePasswordStrength()` - Validates password requirements

2. **utils/email.js** - Email service
   - `sendPasswordResetEmail()` - Sends reset link via email
   - `sendPasswordChangedEmail()` - Sends confirmation email
   - `testEmailConnection()` - Tests email configuration

3. **routes/auth.js** - API endpoints
   - `POST /api/auth/forgot-password` - Request password reset
   - `GET /api/auth/verify-reset-token` - Verify token validity
   - `POST /api/auth/reset-password` - Submit new password

### Frontend Files
1. **public/forgot-password.html** - Request password reset page
2. **public/check-email.html** - Email confirmation page
3. **public/reset-password.html** - Password reset form with strength indicator

### Database
- **PasswordReset table** (Prisma migration applied)
  - Stores reset tokens with expiration times
  - One-time use enforcement
  - Auto-indexes on email and token for performance

### Configuration
- **package.json** - Added bcryptjs and nodemailer dependencies
- **server.js** - Integrated auth routes
- **.env** - Email configuration variables
- **prisma/schema.prisma** - PasswordReset model

## Setup Instructions

### 1. Email Configuration

The system supports Gmail or any SMTP provider. Update your `.env` file:

**For Gmail:**
```env
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
APP_URL=http://localhost:3000
```

#### Getting Gmail App Password:
1. Enable 2-Factor Authentication on your Google Account
2. Go to https://myaccount.google.com/apppasswords
3. Select "Mail" and "Windows Computer"
4. Google will generate a 16-character app password
5. Use this app password (without spaces) in EMAIL_PASSWORD

**For Other SMTP Providers:**
```env
EMAIL_SERVICE=
EMAIL_USER=your-email@provider.com
EMAIL_PASSWORD=your-password
SMTP_HOST=smtp.provider.com
SMTP_PORT=587
SMTP_SECURE=false
APP_URL=http://localhost:3000
```

### 2. Update APP_URL

Set the correct application URL (used in reset links):

```env
# Development
APP_URL=http://localhost:3000

# Production
APP_URL=https://yourdomain.com
```

### 3. Test Email Configuration

After setting up credentials, test the email connection:

```javascript
// In Node.js console or test file
import { testEmailConnection } from './utils/email.js';
const result = await testEmailConnection();
console.log(result);
```

## API Endpoints

### 1. Request Password Reset
**POST** `/api/auth/forgot-password`

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "If an account exists with that email, a reset link has been sent."
}
```

**Features:**
- Rate limiting: 3 requests per hour per email
- Security: Always returns success message (prevents email enumeration)
- Email validation required

### 2. Verify Reset Token
**GET** `/api/auth/verify-reset-token?token={token}`

**Response (Valid):**
```json
{
  "valid": true,
  "email": "user@example.com",
  "message": "Token is valid"
}
```

**Response (Invalid/Expired):**
```json
{
  "valid": false,
  "message": "Invalid or expired token"
}
```

### 3. Reset Password
**POST** `/api/auth/reset-password`

**Request:**
```json
{
  "token": "reset-token-from-email",
  "newPassword": "SecurePass123!",
  "confirmPassword": "SecurePass123!"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Password has been reset successfully. Please log in with your new password."
}
```

**Response (Invalid Password):**
```json
{
  "success": false,
  "message": "Password does not meet requirements",
  "errors": [
    "Password must be at least 8 characters long",
    "Password must contain at least one uppercase letter",
    "..."
  ]
}
```

## Password Requirements

All new passwords must meet these criteria:
- ✓ At least 8 characters long
- ✓ At least one uppercase letter (A-Z)
- ✓ At least one lowercase letter (a-z)
- ✓ At least one number (0-9)
- ✓ At least one special character (!@#$%^&*)

Example of valid password: `MyPassword123!`

## User Flow

### Step 1: Forgot Password
1. User clicks "Forgot Password?" on login page
2. Directed to `/forgot-password.html`
3. Enters email address
4. Backend generates secure token and emails reset link

### Step 2: Email Verification
1. User receives email with reset link (valid for 30 minutes)
2. Link format: `{APP_URL}/reset-password?token={plainToken}`
3. Confirmation page shows `/check-email.html`

### Step 3: Reset Password
1. User clicks link in email
2. Token is verified on page load
3. Password form displayed with strength indicator
4. User enters and confirms new password
5. Password validated against security requirements
6. On success: Redirected to login page
7. Confirmation email sent to user

## Security Features

### Token Security
- ✓ Cryptographically random tokens (32 bytes)
- ✓ Tokens hashed before storage (bcryptjs)
- ✓ One-time use enforcement
- ✓ 30-minute expiration window

### Rate Limiting
- ✓ 3 reset requests per hour per email
- ✓ Prevents abuse without alerting attackers

### Email Privacy
- ✓ Always returns generic success message
- ✓ Prevents email enumeration attacks
- ✓ Non-existent emails not confirmed

### Password Security
- ✓ Strong password requirements enforced
- ✓ Passwords hashed with bcryptjs (10 salt rounds)
- ✓ Confirmation email sent on change

### Frontend Security
- ✓ HTTPS recommended in production
- ✓ Token never stored in localStorage
- ✓ Token only in URL (destroyed on page reload)
- ✓ CSRF tokens via session
- ✓ Input validation on both client and server

## Testing

### Manual Testing

1. **Request Reset:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/forgot-password \
     -H "Content-Type: application/json" \
     -d '{"email":"user@example.com"}'
   ```

2. **Verify Token:**
   ```bash
   curl "http://localhost:3000/api/auth/verify-reset-token?token=YOUR_TOKEN"
   ```

3. **Reset Password:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/reset-password \
     -H "Content-Type: application/json" \
     -d '{
       "token":"YOUR_TOKEN",
       "newPassword":"SecurePass123!",
       "confirmPassword":"SecurePass123!"
     }'
   ```

### Browser Testing

1. Go to http://localhost:3000/forgot-password.html
2. Enter a registered email
3. Check email (Gmail inbox or email service logs)
4. Click reset link
5. Enter new password meeting requirements
6. Click "Reset Password"
7. Should redirect to login page
8. Login with new credentials

## Troubleshooting

### Emails Not Sending

**Problem:** "Failed to send password reset email"

**Solutions:**
1. Verify EMAIL_USER and EMAIL_PASSWORD in .env
2. For Gmail: Ensure App Password is used (not regular password)
3. Test email connection: `node -e "import('./utils/email.js').then(m => m.testEmailConnection())"`
4. Check email service logs
5. Verify firewall/port access (usually port 587)

### Invalid Email Configuration

**Problem:** "Error: connect ECONNREFUSED"

**Solutions:**
1. Verify SMTP_HOST and SMTP_PORT are correct
2. Ensure SMTP_SECURE matches the port:
   - Port 465: SMTP_SECURE=true
   - Port 587: SMTP_SECURE=false
3. Check ISP/firewall blocking SMTP ports

### Tokens Expiring Too Quickly

**Current expiration:** 30 minutes (in `routes/auth.js` line 62)

To change:
```javascript
const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
```

### Reset Link Not Working

1. Check token includes URL-encoded characters properly
2. Verify APP_URL in .env matches your domain
3. Check that token hasn't expired (30 min window)
4. Ensure database connection is working

## Future Enhancements

Consider implementing:
- [ ] SMS-based password reset
- [ ] OAuth provider account recovery
- [ ] Security questions as fallback
- [ ] Send reset link via multiple channels
- [ ] Password reset history/audit log
- [ ] Force password change on next login for sensitive accounts
- [ ] Multi-factor authentication (MFA) integration
- [ ] Passwordless authentication (magic links)
- [ ] Admin user password resets
- [ ] Bulk user password resets

## File Reference

**Backend Routes:**
- [routes/auth.js](../routes/auth.js) - Password reset API

**Utilities:**
- [utils/auth.js](../utils/auth.js) - Crypto and password utilities
- [utils/email.js](../utils/email.js) - Email service

**Frontend:**
- [public/forgot-password.html](../public/forgot-password.html) - Request reset page
- [public/check-email.html](../public/check-email.html) - Email confirmation page
- [public/reset-password.html](../public/reset-password.html) - Password reset page
- [public/login.html](../public/login.html) - Updated with forgot password link

**Database:**
- [prisma/schema.prisma](../prisma/schema.prisma) - PasswordReset model

## Support

For issues or questions about the password reset system:
1. Check the Troubleshooting section above
2. Verify all environment variables are set correctly
3. Check application logs for error messages
4. Ensure database migration was applied successfully
