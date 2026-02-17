/**
 * Registration Service (Backend)
 *
 * Server-side business logic for registrations.
 * Uses Mongoose models directly — no HTTP calls.
 * Controllers delegate to these helpers for reusable logic.
 */

import Registration from '../models/Registration.js';
import Event from '../models/Event.js';

const registrationService = {
  /**
   * Get a single registration by ID, populated.
   */
  getById: async (id) => {
    return Registration.findById(id)
      .populate('event')
      .populate('participant', 'firstName lastName email participantType');
  },

  /**
   * Get registrations for a participant.
   */
  getParticipantRegistrations: async (participantId, { page = 1, limit = 20 } = {}) => {
    const skip = (page - 1) * limit;
    const [registrations, total] = await Promise.all([
      Registration.find({ participant: participantId })
        .populate('event', 'name eventType eventStartDate eventEndDate venue status organizer')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Registration.countDocuments({ participant: participantId })
    ]);
    return { registrations, total };
  },

  /**
   * Get all registrations for a specific event (organizer view).
   */
  getEventRegistrations: async (eventId, { search, status } = {}) => {
    const query = { event: eventId };
    if (status) query.status = status;

    let registrations = await Registration.find(query)
      .populate('participant', 'firstName lastName email participantType')
      .sort({ createdAt: -1 });

    // Optional server-side name/email search
    if (search) {
      const term = search.toLowerCase();
      registrations = registrations.filter(r => {
        const p = r.participant;
        return (
          (p?.firstName || '').toLowerCase().includes(term) ||
          (p?.lastName || '').toLowerCase().includes(term) ||
          (p?.email || '').toLowerCase().includes(term) ||
          (r.ticketId || '').toLowerCase().includes(term)
        );
      });
    }
    return registrations;
  },

  /**
   * Cancel a registration.
   */
  cancel: async (registrationId) => {
    const reg = await Registration.findById(registrationId).populate('event');
    if (!reg) return null;

    reg.status = 'cancelled';
    await reg.save();

    // Decrement event registration count
    await Event.findByIdAndUpdate(reg.event._id, { $inc: { registrationCount: -1 } });
    return reg;
  },

  /**
   * Mark attendance for a registration.
   */
  markAttendance: async (registrationId) => {
    const reg = await Registration.findById(registrationId);
    if (!reg) return null;

    reg.attended = true;
    reg.attendedAt = new Date();
    reg.status = 'attended';
    await reg.save();
    return reg;
  },

  /**
   * Get all registrations across all events for an organizer.
   */
  getOrganizerRegistrations: async (organizerId) => {
    const events = await Event.find({ organizer: organizerId }).select('_id');
    const eventIds = events.map(e => e._id);

    return Registration.find({ event: { $in: eventIds } })
      .populate('event')
      .populate('participant', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(1000);
  },

  /**
   * Get attendance dashboard data for an event.
   */
  getAttendanceDashboard: async (eventId) => {
    const [total, attended, notAttended, attendedList] = await Promise.all([
      Registration.countDocuments({ event: eventId, status: { $in: ['confirmed', 'attended'] } }),
      Registration.countDocuments({ event: eventId, attended: true }),
      Registration.find({ event: eventId, status: 'confirmed', attended: false })
        .populate('participant', 'firstName lastName email')
        .sort({ registeredAt: -1 }),
      Registration.find({ event: eventId, attended: true })
        .populate('participant', 'firstName lastName email')
        .sort({ attendedAt: -1 })
    ]);

    return {
      stats: { total, attended, pending: total - attended },
      attendedList,
      notAttendedList: notAttended
    };
  }
};

export default registrationService;
