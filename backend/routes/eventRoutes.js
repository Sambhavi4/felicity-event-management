/**
 * Event Routes
 * 
 * BASE: /api/events
 * 
 * IMPORTANT: Specific routes MUST come before parameterized routes
 * to prevent Express from matching them as :id
 */

import express from 'express';
import {
  createEvent,
  getEvents,
  getEvent,
  updateEvent,
  deleteEvent,
  getTrendingEvents,
  getRecommendations,
  getMyEvents,
  getEventAnalytics,
  getOrganizerAnalytics,
  publishEvent
} from '../controllers/eventController.js';
import { protect, authorize, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// === SPECIFIC ROUTES FIRST (before :id) ===
router.get('/trending', getTrendingEvents);
router.get('/recommendations', optionalAuth, getRecommendations);
router.get('/organizer/my-events', protect, authorize('organizer'), getMyEvents);
router.get('/organizer/analytics', protect, authorize('organizer','admin'), getOrganizerAnalytics);
router.post('/', protect, authorize('organizer'), createEvent);
router.get('/', optionalAuth, getEvents);

// === PARAMETERIZED ROUTES ===
router.get('/:id/analytics', protect, authorize('organizer', 'admin'), getEventAnalytics);
router.put('/:id/publish', protect, authorize('organizer'), publishEvent);
router.put('/:id', protect, authorize('organizer', 'admin'), updateEvent);
router.delete('/:id', protect, authorize('organizer', 'admin'), deleteEvent);
router.get('/:id', optionalAuth, getEvent);

export default router;
