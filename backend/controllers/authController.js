/**
 * Authentication Controller
 * 
 * HANDLES:
 * - Participant registration (IIIT and non-IIIT)
 * - User login (all roles)
 * - Token refresh
 * - Password change
 * 
 * SECURITY MEASURES:
 * - Email domain validation for IIIT students
 * - Password hashing (handled in model)
 * - JWT token generation
 * - Role-based response data
 */

import User from '../models/User.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { sendTokenResponse } from '../utils/jwt.js';
import { generateCaptcha, verifyCaptcha } from '../utils/captcha.js';

/**
 * @desc    Get a new CAPTCHA image
 * @route   GET /api/auth/captcha
 * @access  Public
 */
export const getCaptcha = asyncHandler(async (req, res) => {
  const captcha = generateCaptcha();
  res.json({ success: true, captchaId: captcha.id, captchaSvg: captcha.svg });
});

/**
 * @desc    Register a new participant
 * @route   POST /api/auth/register
 * @access  Public
 * 
 * FLOW:
 * 1. Validate email domain for IIIT participants
 * 2. Check if email already exists
 * 3. Create user with hashed password
 * 4. Generate JWT token
 * 5. Send response with token
 */
export const register = asyncHandler(async (req, res, next) => {
  const { email, password, firstName, lastName, participantType, collegeName, contactNumber, captchaId, captchaAnswer } = req.body;

  // Verify CAPTCHA
  if (!verifyCaptcha(captchaId, captchaAnswer)) {
    throw new AppError('Invalid or expired CAPTCHA. Please try again.', 400);
  }
  
  // Validate required fields
  if (!email || !password || !firstName) {
    throw new AppError('Please provide email, password, and first name', 400);
  }
  
  // Validate participant type
  if (!participantType || !['iiit', 'non-iiit'].includes(participantType)) {
    throw new AppError('Please specify participant type (iiit or non-iiit)', 400);
  }
  
  // Email domain validation
  // Requirement: IIIT participants must use IIIT-issued email
  //              External participants must NOT use IIIT email addresses
  const iiitDomains = ['iiit.ac.in', 'students.iiit.ac.in', 'research.iiit.ac.in'];
  const emailParts = (email || '').split('@');
  const emailDomain = emailParts[1] || '';

  if (participantType === 'iiit') {
    if (!iiitDomains.includes(emailDomain)) {
      throw new AppError('IIIT participants must register with an IIIT email address', 400);
    }
  }

  if (participantType === 'non-iiit') {
    if (iiitDomains.includes(emailDomain)) {
      throw new AppError('External participants must not register with an IIIT email address', 400);
    }
  }
  
  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError('Email already registered', 400);
  }
  
  // Create user
  const user = await User.create({
    email,
    password, // Hashed in pre-save middleware
    firstName,
    lastName,
    participantType,
    collegeName: participantType === 'iiit' ? 'IIIT Hyderabad' : collegeName,
    contactNumber,
    role: 'participant',
    onboardingCompleted: false
  });
  
  // Send token response
  sendTokenResponse(user, 201, res, 'Registration successful');
});

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 * 
 * FLOW:
 * 1. Validate email and password provided
 * 2. Find user and include password field
 * 3. Verify password with bcrypt compare
 * 4. Check if account is active
 * 5. Generate and send JWT token
 */
export const login = asyncHandler(async (req, res, next) => {
  const { email, password, captchaId, captchaAnswer } = req.body;

  // Verify CAPTCHA
  if (!verifyCaptcha(captchaId, captchaAnswer)) {
    throw new AppError('Invalid or expired CAPTCHA. Please try again.', 400);
  }
  
  // Validate input
  if (!email || !password) {
    throw new AppError('Please provide email and password', 400);
  }
  
  // Find user with password field (normally excluded)
  const user = await User.findOne({ email }).select('+password');
  
  if (!user) {
    throw new AppError('Invalid credentials', 401);
  }
  
  // Check if account is active
  if (!user.isActive) {
    throw new AppError('Your account has been deactivated. Please contact admin.', 401);
  }
  
  // Verify password
  const isMatch = await user.comparePassword(password);
  
  if (!isMatch) {
    throw new AppError('Invalid credentials', 401);
  }
  
  // Send token response
  sendTokenResponse(user, 200, res, 'Login successful');
});

/**
 * @desc    Get current logged-in user
 * @route   GET /api/auth/me
 * @access  Private
 * 
 * WHY THIS ENDPOINT?
 * - Frontend can verify token validity on page load
 * - Get latest user data without re-login
 * - Refresh user state after profile updates
 */
export const getMe = asyncHandler(async (req, res, next) => {
  // req.user is set by protect middleware
  const user = await User.findById(req.user.id)
    .populate('followedOrganizers', 'organizerName category');
  
  res.status(200).json({
    success: true,
    user: user.getPublicProfile()
  });
});

/**
 * @desc    Update password
 * @route   PUT /api/auth/password
 * @access  Private
 * 
 * FLOW:
 * 1. Verify current password
 * 2. Validate new password
 * 3. Update and hash new password
 * 4. Generate new token (invalidate old sessions)
 */
export const updatePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    throw new AppError('Please provide current and new password', 400);
  }
  
  if (newPassword.length < 6) {
    throw new AppError('New password must be at least 6 characters', 400);
  }
  
  // Get user with password
  const user = await User.findById(req.user.id).select('+password');
  
  // Verify current password
  const isMatch = await user.comparePassword(currentPassword);
  
  if (!isMatch) {
    throw new AppError('Current password is incorrect', 401);
  }
  
  // Update password (hashed in pre-save)
  user.password = newPassword;
  await user.save();
  
  // Send new token
  sendTokenResponse(user, 200, res, 'Password updated successfully');
});

/**
 * @desc    Logout user (client-side token removal)
 * @route   POST /api/auth/logout
 * @access  Private
 * 
 * NOTE: With JWT, logout is primarily client-side
 * Server just confirms the logout request
 * For true invalidation, you'd need a token blacklist (Redis)
 */
export const logout = asyncHandler(async (req, res, next) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});

/**
 * @desc    Complete onboarding (set preferences)
 * @route   PUT /api/auth/onboarding
 * @access  Private (Participants only)
 */
export const completeOnboarding = asyncHandler(async (req, res, next) => {
  const { interests, followedOrganizers, skip } = req.body;
  
  // Check if user is participant
  if (req.user.role !== 'participant') {
    throw new AppError('Only participants can complete onboarding', 403);
  }
  
  const updateData = { onboardingCompleted: true };
  
  if (!skip) {
    if (interests && Array.isArray(interests)) {
      updateData.interests = interests;
    }
    
    if (followedOrganizers && Array.isArray(followedOrganizers)) {
      updateData.followedOrganizers = followedOrganizers;
    }
  }
  
  const user = await User.findByIdAndUpdate(
    req.user.id,
    updateData,
    { new: true, runValidators: true }
  ).populate('followedOrganizers', 'organizerName category');
  
  res.status(200).json({
    success: true,
    message: 'Onboarding completed',
    user: user.getPublicProfile()
  });
});
