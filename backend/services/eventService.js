/**
 * Event Service (Backend)
 *
 * Server-side business logic for events.
 * Uses Mongoose models directly — no HTTP calls.
 * Controllers delegate to these helpers for reusable logic.
 */

import Event from '../models/Event.js';
import Registration from '../models/Registration.js';

const eventService = {
  /**
   * Find published events with optional filters.
   */
  getPublishedEvents: async (filters = {}, { page = 1, limit = 10 } = {}) => {
    const query = { status: 'published', ...filters };
    const skip = (page - 1) * limit;
    const [events, total] = await Promise.all([
      Event.find(query)
        .populate('organizer', 'organizerName category')
        .sort({ eventStartDate: 1 })
        .skip(skip)
        .limit(Number(limit)),
      Event.countDocuments(query)
    ]);
    return { events, total, page: Number(page), pages: Math.ceil(total / limit) };
  },

  /**
   * Get a single event by ID (increments view count).
   */
  getEventById: async (id) => {
    const event = await Event.findById(id)
      .populate('organizer', 'organizerName category email description');
    if (!event) return null;
    // Increment view
    event.viewCount = (event.viewCount || 0) + 1;
    event.recentViews = [...(event.recentViews || []), { timestamp: new Date() }];
    await event.save();
    return event;
  },

  /**
   * Trending events (delegates to model static).
   */
  getTrending: async (limit = 5) => {
    return Event.getTrending(limit);
  },

  /**
   * Create a new event (draft).
   */
  createEvent: async (data) => {
    return Event.create({ ...data, status: 'draft' });
  },

  /**
   * Update event fields.
   */
  updateEvent: async (id, data) => {
    return Event.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  },

  /**
   * Delete event and its registrations.
   */
  deleteEvent: async (id) => {
    await Registration.deleteMany({ event: id });
    return Event.findByIdAndDelete(id);
  },

  /**
   * Publish a draft event.
   */
  publishEvent: async (id) => {
    return Event.findByIdAndUpdate(id, { status: 'published' }, { new: true });
  },

  /**
   * Get events owned by a specific organizer.
   */
  getOrganizerEvents: async (organizerId, { page = 1, limit = 50 } = {}) => {
    const skip = (page - 1) * limit;
    const [events, total] = await Promise.all([
      Event.find({ organizer: organizerId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Event.countDocuments({ organizer: organizerId })
    ]);
    return { events, total };
  },

  /**
   * Analytics for a single event.
   */
  getEventAnalytics: async (eventId) => {
    const event = await Event.findById(eventId);
    if (!event) return null;

    const [total, attended, byStatus] = await Promise.all([
      Registration.countDocuments({ event: eventId, status: { $nin: ['cancelled'] } }),
      Registration.countDocuments({ event: eventId, attended: true }),
      Registration.aggregate([
        { $match: { event: event._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
    ]);

    const statusMap = {};
    byStatus.forEach(s => { statusMap[s._id] = s.count; });

    return {
      totalRegistrations: total,
      attended,
      registrationsByStatus: statusMap,
      views: event.viewCount || 0,
      registrationLimit: event.registrationLimit,
      registrationCount: event.registrationCount
    };
  },

  /**
   * Aggregate analytics across all events for an organizer.
   */
  getOrganizerAnalytics: async (organizerId) => {
    const events = await Event.find({ organizer: organizerId });
    if (!events.length) {
      return { totalRegistrations: 0, registrationsByStatus: {}, revenue: 0, attendance: { total: 0, attended: 0 }, views: 0, registrationTrend: [], events: [] };
    }

    const eventIds = events.map(e => e._id);
    const regs = await Registration.find({ event: { $in: eventIds } });

    const statusMap = {};
    let totalAttended = 0;
    let revenue = 0;
    regs.forEach(r => {
      statusMap[r.status] = (statusMap[r.status] || 0) + 1;
      if (r.attended) totalAttended++;
      if (r.totalAmount) revenue += r.totalAmount;
    });

    const views = events.reduce((s, e) => s + (e.viewCount || 0), 0);

    return {
      totalRegistrations: regs.length,
      registrationsByStatus: statusMap,
      revenue,
      attendance: { total: regs.length, attended: totalAttended },
      views,
      events: events.map(e => ({ _id: e._id, name: e.name, status: e.status, registrationCount: e.registrationCount }))
    };
  }
};

export default eventService;
