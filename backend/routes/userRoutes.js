/**
 * User Routes
 * 
 * BASE: /api/users
 */

import express from 'express';
import {
  updateProfile,
  updateOrganizerProfile,
  getOrganizers,
  getOrganizer,
  followOrganizer,
  unfollowOrganizer,
  getFollowedOrganizers,
  updateInterests,
  requestPasswordReset
} from '../controllers/userController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/organizers', getOrganizers);
router.get('/organizers/:id', getOrganizer);

// Participant routes
router.put('/profile', protect, authorize('participant'), updateProfile);
router.put('/interests', protect, authorize('participant'), updateInterests);
router.post('/follow/:organizerId', protect, authorize('participant'), followOrganizer);
router.delete('/follow/:organizerId', protect, authorize('participant'), unfollowOrganizer);
router.get('/following', protect, authorize('participant'), getFollowedOrganizers);

// Organizer routes
router.put('/organizer-profile', protect, authorize('organizer'), updateOrganizerProfile);
router.post('/request-password-reset', protect, authorize('organizer'), requestPasswordReset);

export default router;
