/**
 * Notification Controller
 * 
 * Handles fetching, marking read, and creating in-app notifications.
 */

import Notification from '../models/Notification.js';
import Registration from '../models/Registration.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

/**
 * @desc    Get notifications for current user
 * @route   GET /api/notifications
 * @access  Private
 */
export const getNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, unreadOnly } = req.query;
  const query = { recipient: req.user.id };
  if (unreadOnly === 'true') query.read = false;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('sender', 'firstName lastName organizerName')
      .populate('event', 'name'),
    Notification.countDocuments(query),
    Notification.countDocuments({ recipient: req.user.id, read: false })
  ]);

  res.status(200).json({ success: true, notifications, total, unreadCount });
});

/**
 * @desc    Get unread count
 * @route   GET /api/notifications/unread-count
 * @access  Private
 */
export const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({ recipient: req.user.id, read: false });
  res.status(200).json({ success: true, count });
});

/**
 * @desc    Mark notification(s) as read
 * @route   PUT /api/notifications/read
 * @access  Private
 */
export const markAsRead = asyncHandler(async (req, res) => {
  const { ids } = req.body; // array of notification ids, or 'all'
  if (ids === 'all') {
    await Notification.updateMany({ recipient: req.user.id, read: false }, { read: true });
  } else if (Array.isArray(ids) && ids.length) {
    await Notification.updateMany({ _id: { $in: ids }, recipient: req.user.id }, { read: true });
  }
  res.status(200).json({ success: true });
});

/**
 * @desc    Delete a notification
 * @route   DELETE /api/notifications/:id
 * @access  Private
 */
export const deleteNotification = asyncHandler(async (req, res) => {
  await Notification.deleteOne({ _id: req.params.id, recipient: req.user.id });
  res.status(200).json({ success: true });
});

/**
 * Helper: Create notification(s) for event participants
 * Called internally from other controllers — not an HTTP endpoint.
 */
export const notifyEventParticipants = async ({ eventId, senderId, type, title, message, link, excludeUser }) => {
  try {
    // Find all confirmed/attended registrations for this event
    const registrations = await Registration.find({
      event: eventId,
      status: { $in: ['confirmed', 'attended'] }
    }).select('participant');

    const recipientIds = registrations
      .map(r => r.participant.toString())
      .filter(id => id !== excludeUser?.toString());

    if (recipientIds.length === 0) return;

    const docs = recipientIds.map(rid => ({
      recipient: rid,
      type,
      title,
      message: message.slice(0, 500),
      link,
      event: eventId,
      sender: senderId
    }));

    await Notification.insertMany(docs);
  } catch (err) {
    console.error('Failed to create notifications:', err.message);
  }
};

/**
 * Helper: Create a single notification
 */
export const createNotification = async ({ recipient, type, title, message, link, event, sender }) => {
  try {
    await Notification.create({ recipient, type, title, message: message.slice(0, 500), link, event, sender });
  } catch (err) {
    console.error('Failed to create notification:', err.message);
  }
};
