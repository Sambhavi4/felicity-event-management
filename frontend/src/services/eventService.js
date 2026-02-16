/**
 * Event Service
 * 
 * Handles all event-related API calls
 */

import api from './api';

const eventService = {
  /**
   * Get all events with filters
   */
  getEvents: async (params = {}) => {
    const response = await api.get('/events', { params });
    return response.data;
  },

  /**
   * Get single event
   */
  getEvent: async (id) => {
    const response = await api.get(`/events/${id}`);
    return response.data;
  },

  /**
   * Get trending events
   */
  getTrending: async (limit = 5) => {
    const response = await api.get('/events/trending', { params: { limit } });
    return response.data;
  },

  /**
   * Get personalized recommendations (server personalizes if logged-in)
   */
  getRecommendations: async (limit = 5) => {
    const response = await api.get('/events/recommendations', { params: { limit } });
    return response.data;
  },

  /**
   * Create new event (organizer)
   */
  createEvent: async (eventData) => {
    const response = await api.post('/events', eventData);
    return response.data;
  },

  /**
   * Update event
   */
  updateEvent: async (id, eventData) => {
    const response = await api.put(`/events/${id}`, eventData);
    return response.data;
  },

  /**
   * Delete event
   */
  deleteEvent: async (id) => {
    const response = await api.delete(`/events/${id}`);
    return response.data;
  },

  /**
   * Publish event
   */
  publishEvent: async (id) => {
    const response = await api.put(`/events/${id}/publish`);
    return response.data;
  },

  /**
   * Get organizer's events
   */
  getMyEvents: async (params = {}) => {
    const response = await api.get('/events/organizer/my-events', { params });
    return response.data;
  },

  /**
   * Get event analytics
   */
  getEventAnalytics: async (id) => {
    const response = await api.get(`/events/${id}/analytics`);
    return response.data;
  },

  /**
   * Get organizer-wide analytics (all events)
   */
  getOrganizerAnalytics: async () => {
    const response = await api.get('/events/organizer/analytics');
    return response.data;
  }
  ,
  getOrganizerAnalytics: async () => {
    const response = await api.get('/events/organizer/analytics');
    return response.data;
  }
};

export default eventService;
