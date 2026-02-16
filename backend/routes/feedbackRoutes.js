/**
 * Feedback Routes (Tier C Feature)
 * 
 * BASE: /api/feedback
 */

import express from 'express';
import { submitFeedback, getEventFeedback, exportEventFeedback } from '../controllers/feedbackController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.post('/:eventId', protect, authorize('participant'), submitFeedback);
router.get('/:eventId/export', protect, authorize('organizer', 'admin'), exportEventFeedback);
// Allow any authenticated user to view feedback (participants see it anonymously)
router.get('/:eventId', protect, getEventFeedback);

export default router;
