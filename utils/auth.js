import crypto from 'crypto';
import bcryptjs from 'bcryptjs';

/**
 * Generate a secure reset token
 * @returns {string} Random token
 */
export function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a token for storage
 * @param {string} token - Token to hash
 * @returns {string} Hashed token
 */
export async function hashToken(token) {
  const salt = await bcryptjs.genSalt(10);
  return bcryptjs.hash(token, salt);
}

/**
 * Verify a token against its hash
 * @param {string} token - Plain token
 * @param {string} hashedToken - Hashed token from DB
 * @returns {boolean}
 */
export async function verifyToken(token, hashedToken) {
  return bcryptjs.compare(token, hashedToken);
}

/**
 * Hash password
 * @param {string} password - Password to hash
 * @returns {string} Hashed password
 */
export async function hashPassword(password) {
  const salt = await bcryptjs.genSalt(10);
  return bcryptjs.hash(password, salt);
}

/**
 * Verify password
 * @param {string} password - Plain password
 * @param {string} hashedPassword - Hashed password from DB
 * @returns {boolean}
 */
export async function verifyPassword(password, hashedPassword) {
  return bcryptjs.compare(password, hashedPassword);
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} { isValid, errors[] }
 */
export function validatePasswordStrength(password) {
  const errors = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[!@#$%^&*]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*)');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
