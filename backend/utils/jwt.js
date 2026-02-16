/**
 * JWT Token Utilities
 * 
 * WHY SEPARATE UTILITY?
 * - Single source of truth for token generation
 * - Easy to modify token payload or options
 * - Reusable across auth controller
 */

import jwt from 'jsonwebtoken';

/**
 * Generate JWT Token
 * 
 * @param {string} id - User ID to encode in token
 * @returns {string} - Signed JWT token
 * 
 * PAYLOAD CONSIDERATIONS:
 * - Only include user ID in payload
 * - Sensitive data (email, role) fetched from DB when needed
 * - Keeps token small and secure
 */
export const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

/**
 * Send token response
 * Creates token and sends it with user data
 */
export const sendTokenResponse = (user, statusCode, res, message = 'Success') => {
  const token = generateToken(user._id);
  
  // Get user data without sensitive fields
  const userData = user.getPublicProfile ? user.getPublicProfile() : user.toObject();
  delete userData.password;
  
  res.status(statusCode).json({
    success: true,
    message,
    token,
    user: userData
  });
};
