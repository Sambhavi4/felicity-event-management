/**
 * Discussion Controller (Tier B Feature)
 * 
 * Real-time discussion forum on Event Details page.
 */

import Message from '../models/Message.js';
import Registration from '../models/Registration.js';
import Event from '../models/Event.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

/**
 * @desc    Post a message to event discussion
 * @route   POST /api/discussions/:eventId
 * @access  Private (Registered participants + event organizer)
 */
export const postMessage = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { content, parentMessage, isAnnouncement } = req.body;

  if (!content || content.trim().length === 0) {
    throw new AppError('Message content is required', 400);
  }

  const event = await Event.findById(eventId);
  if (!event) throw new AppError('Event not found', 404);

  // Check if user is organizer of this event or a registered participant
  const isOrganizer = event.organizer.toString() === req.user.id;
  if (!isOrganizer && req.user.role !== 'admin') {
    const registration = await Registration.findOne({
      event: eventId,
      participant: req.user.id,
      status: { $in: ['confirmed', 'attended'] }
    });
    if (!registration) {
      throw new AppError('You must be registered for this event to post messages', 403);
    }
  }

  const message = await Message.create({
    event: eventId,
    author: req.user.id,
    content: content.trim(),
    parentMessage: parentMessage || null,
    isAnnouncement: isOrganizer ? !!isAnnouncement : false
  });

  await message.populate('author', 'firstName lastName organizerName role');

  res.status(201).json({ success: true, message: message });
});

/**
 * @desc    Get messages for an event
 * @route   GET /api/discussions/:eventId
 * @access  Private (Registered participants + event organizer)
 */
export const getMessages = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { page = 1, limit = 50, after } = req.query;

  const query = { event: eventId, isDeleted: false };

  // For polling: get messages after a certain timestamp
  if (after) {
    query.createdAt = { $gt: new Date(after) };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const messages = await Message.find(query)
    .populate('author', 'firstName lastName organizerName role')
    .populate('parentMessage', 'content author')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Message.countDocuments({ event: eventId, isDeleted: false });

  res.status(200).json({
    success: true,
    count: messages.length,
    total,
    messages: messages.reverse() // Chronological order
  });
});

/**
 * @desc    Delete a message (moderator/organizer)
 * @route   DELETE /api/discussions/:eventId/:messageId
 * @access  Private (Organizer of event or Admin)
 */
export const deleteMessage = asyncHandler(async (req, res) => {
  const { eventId, messageId } = req.params;

  const event = await Event.findById(eventId);
  if (!event) throw new AppError('Event not found', 404);

  const isOrganizer = event.organizer.toString() === req.user.id;
  if (!isOrganizer && req.user.role !== 'admin') {
    // Authors can also delete their own messages
    const message = await Message.findById(messageId);
    if (!message || message.author.toString() !== req.user.id) {
      throw new AppError('Not authorized to delete this message', 403);
    }
  }

  await Message.findByIdAndUpdate(messageId, { isDeleted: true });

  res.status(200).json({ success: true, message: 'Message deleted' });
});

/**
 * @desc    Pin/Unpin a message (organizer only)
 * @route   PUT /api/discussions/:eventId/:messageId/pin
 * @access  Private (Organizer of event)
 */
export const togglePinMessage = asyncHandler(async (req, res) => {
  const { eventId, messageId } = req.params;

  const event = await Event.findById(eventId);
  if (!event) throw new AppError('Event not found', 404);

  if (event.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('Only the organizer can pin messages', 403);
  }

  const message = await Message.findById(messageId);
  if (!message) throw new AppError('Message not found', 404);

  message.isPinned = !message.isPinned;
  await message.save();

  res.status(200).json({ success: true, isPinned: message.isPinned });
});

/**
 * @desc    React to a message
 * @route   POST /api/discussions/:eventId/:messageId/react
 * @access  Private
 */
export const reactToMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { emoji = '👍' } = req.body;

  const message = await Message.findById(messageId);
  if (!message) throw new AppError('Message not found', 404);

  // Toggle reaction
  const existingIdx = message.reactions.findIndex(
    r => r.user.toString() === req.user.id && r.emoji === emoji
  );

  if (existingIdx !== -1) {
    message.reactions.splice(existingIdx, 1);
  } else {
    message.reactions.push({ user: req.user.id, emoji });
  }

  await message.save();

  res.status(200).json({ success: true, reactions: message.reactions });
});
