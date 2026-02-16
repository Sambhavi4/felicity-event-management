/**
 * User Service
 * 
 * Handles user profile and organizer operations
 */

import api from './api';

const userService = {
  /**
   * Update participant profile
   */
  updateProfile: async (profileData) => {
    const response = await api.put('/users/profile', profileData);
    return response.data;
  },

  /**
   * Update organizer profile
   */
  updateOrganizerProfile: async (profileData) => {
    const response = await api.put('/users/organizer-profile', profileData);
    return response.data;
  },

  /**
   * Get all organizers (public)
   */
  getOrganizers: async (params = {}) => {
    const response = await api.get('/users/organizers', { params });
    return response.data;
  },

  /**
   * Get single organizer
   */
  getOrganizer: async (id) => {
    const response = await api.get(`/users/organizers/${id}`);
    return response.data;
  },

  /**
   * Follow organizer
   */
  followOrganizer: async (organizerId) => {
    const response = await api.post(`/users/follow/${organizerId}`);
    return response.data;
  },

  /**
   * Unfollow organizer
   */
  unfollowOrganizer: async (organizerId) => {
    const response = await api.delete(`/users/follow/${organizerId}`);
    return response.data;
  },

  /**
   * Get followed organizers
   */
  getFollowedOrganizers: async () => {
    const response = await api.get('/users/following');
    return response.data;
  },

  /**
   * Update interests
   */
  updateInterests: async (interests) => {
    const response = await api.put('/users/interests', { interests });
    return response.data;
  },

  /**
   * Request password reset (organizer)
   */
  requestPasswordReset: async (reason = '') => {
    const response = await api.post('/users/request-password-reset', { reason });
    return response.data;
  }
};

export default userService;
