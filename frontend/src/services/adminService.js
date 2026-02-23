/**
 * Admin Service
 * 
 * Handles admin operations
 */

import api from './api';

const adminService = {
  /**
   * Get dashboard stats
   */
  getStats: async () => {
    const response = await api.get('/admin/stats');
    return response.data;
  },

  /**
   * Get all organizers
   */
  getOrganizers: async (params = {}) => {
    const response = await api.get('/admin/organizers', { params });
    return response.data;
  },

  /**
   * Get single organizer
   */
  getOrganizer: async (id) => {
    const response = await api.get(`/admin/organizers/${id}`);
    return response.data;
  },

  /**
   * Create organizer
   */
  createOrganizer: async (organizerData) => {
    const response = await api.post('/admin/organizers', organizerData);
    return response.data;
  },

  /**
   * Update organizer
   */
  updateOrganizer: async (id, organizerData) => {
    const response = await api.put(`/admin/organizers/${id}`, organizerData);
    return response.data;
  },

  /**
   * Toggle organizer status
   */
  toggleOrganizerStatus: async (id) => {
    const response = await api.put(`/admin/organizers/${id}/toggle-status`);
    return response.data;
  },

  /**
   * Delete organizer
   */
  deleteOrganizer: async (id, permanent = false) => {
    const response = await api.delete(`/admin/organizers/${id}`, {
      params: { permanent }
    });
    return response.data;
  },

  /**
   * Reset organizer password
   */
  resetOrganizerPassword: async (id) => {
    const response = await api.post(`/admin/organizers/${id}/reset-password`);
    return response.data;
  },

  /**
   * Get password reset requests
   */
  getPasswordResetRequests: async () => {
    const response = await api.get('/admin/password-reset-requests');
    return response.data;
  }
  ,

  actionPasswordResetRequest: async (id, action, comment = '') => {
    const response = await api.put(`/admin/password-reset/${id}/action`, { action, comment });
    return response.data;
  },

  getPasswordResetHistory: async () => {
    const response = await api.get('/admin/password-reset-history');
    return response.data;
  }
};

export default adminService;
