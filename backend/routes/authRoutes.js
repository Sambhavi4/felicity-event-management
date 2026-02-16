/**
 * Authentication Routes
 * 
 * BASE: /api/auth
 */

import express from 'express';
import {
  register,
  login,
  getMe,
  updatePassword,
  logout,
  completeOnboarding,
  getCaptcha
} from '../controllers/authController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/captcha', getCaptcha);
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);
router.put('/password', protect, updatePassword);
router.put('/onboarding', protect, authorize('participant'), completeOnboarding);

export default router;
