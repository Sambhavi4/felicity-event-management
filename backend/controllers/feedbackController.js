/**
 * Feedback Controller (Tier C Feature)
 * 
 * Anonymous Feedback System for completed events.
 */

import Feedback from '../models/Feedback.js';
import Registration from '../models/Registration.js';
import Event from '../models/Event.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

/**
 * @desc    Submit feedback for an event
 * @route   POST /api/feedback/:eventId
 * @access  Private (Participant - must have attended)
 */
export const submitFeedback = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    throw new AppError('Rating must be between 1 and 5', 400);
  }

  // Check event exists and is completed
  const event = await Event.findById(eventId);
  if (!event) throw new AppError('Event not found', 404);

  // Allow feedback when: event is completed/closed OR event end time has passed OR the participant was marked attended
  const now = new Date();
  const eventEnded = event.eventEndDate && now > new Date(event.eventEndDate);

  // Check participant was registered (must be confirmed/attended)
  const registration = await Registration.findOne({
    event: eventId,
    participant: req.user.id,
    status: { $in: ['confirmed', 'attended'] }
  });
  if (!registration) {
    throw new AppError('You must have been registered for this event to submit feedback', 403);
  }

  const participantMarkedAttended = !!registration.attended;

  // If the found registration is not marked attended, check if any registration for this user/event has attended=true
  const attendedExists = participantMarkedAttended || await Registration.exists({ event: eventId, participant: req.user.id, attended: true });

  // Debug info for tracing why feedback may be blocked
  console.debug('[submitFeedback] eventId=', eventId, 'event.status=', event.status, 'eventEnded=', !!eventEnded, 'participantMarkedAttended=', participantMarkedAttended, 'attendedExists=', attendedExists);

  if (!(['completed', 'closed'].includes(event.status) || eventEnded || attendedExists)) {
    throw new AppError('Feedback can only be submitted for completed events', 400);
  }

  // Check if already submitted
  const existing = await Feedback.findOne({ event: eventId, participant: req.user.id });
  if (existing) {
    throw new AppError('You have already submitted feedback for this event', 400);
  }

  const feedback = await Feedback.create({
    event: eventId,
    participant: req.user.id,
    rating,
    comment
  });

  res.status(201).json({ success: true, message: 'Feedback submitted', feedback });
});

/**
 * @desc    Get feedback for an event (organizer/admin)
 * @route   GET /api/feedback/:eventId
 * @access  Private (Organizer who owns event, or Admin)
 */
export const getEventFeedback = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { rating, page = 1, limit = 20 } = req.query;

  const event = await Event.findById(eventId);
  if (!event) throw new AppError('Event not found', 404);

  // Anyone authenticated can view anonymous feedback — no role check needed

  const query = { event: eventId };
  if (rating) query.rating = parseInt(rating);

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [feedbacks, total, stats] = await Promise.all([
    Feedback.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Feedback.countDocuments(query),
    Feedback.aggregate([
      { $match: { event: event._id } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalFeedbacks: { $sum: 1 },
          ratings: { $push: '$rating' }
        }
      }
    ])
  ]);

  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  if (stats[0]) {
    stats[0].ratings.forEach(r => { ratingDistribution[r]++; });
  }

  res.status(200).json({
    success: true,
    count: feedbacks.length,
    total,
    averageRating: parseFloat(stats[0]?.averageRating?.toFixed(1) || 0),
    stats: {
      averageRating: stats[0]?.averageRating?.toFixed(1) || 0,
      totalFeedbacks: stats[0]?.totalFeedbacks || 0,
      ratingDistribution
    },
    feedback: feedbacks,
    feedbacks
  });
});


/**
 * @desc    Export feedback as CSV (anonymous)
 * @route   GET /api/feedback/:eventId/export
 * @access  Private (Organizer who owns event, or Admin)
 */
export const exportEventFeedback = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { rating } = req.query;

  const event = await Event.findById(eventId);
  if (!event) throw new AppError('Event not found', 404);

  // Check access
  if (req.user.role === 'organizer' && event.organizer.toString() !== req.user.id) {
    throw new AppError('Not authorized', 403);
  }

  const query = { event: eventId };
  if (rating) query.rating = parseInt(rating);

  const feedbacks = await Feedback.find(query).sort({ createdAt: -1 });

  // Build CSV: anonymous (do NOT include participant identifiers)
  const headers = ['rating', 'comment', 'createdAt'];
  const lines = [headers.join(',')];
  for (const f of feedbacks) {
    // Escape double quotes in comment
    const comment = (f.comment || '').replace(/"/g, '""');
    const row = [f.rating, `"${comment}"`, new Date(f.createdAt).toISOString()];
    lines.push(row.join(','));
  }

  const csv = lines.join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="feedback_${eventId}.csv"`);
  res.status(200).send(csv);
});
