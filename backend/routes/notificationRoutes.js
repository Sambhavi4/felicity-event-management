/**
 * Notification Routes
 * 
 * BASE: /api/notifications
 */

import express from 'express';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  deleteNotification
} from '../controllers/notificationController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, getNotifications);
router.get('/unread-count', protect, getUnreadCount);
router.put('/read', protect, markAsRead);
router.delete('/:id', protect, deleteNotification);

export default router;
