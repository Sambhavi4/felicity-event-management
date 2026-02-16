/**
 * Registration Service
 * 
 * Handles event registration and ticket management
 */

import api from './api';

const registrationService = {
  /**
   * Register for a normal event
   */
  registerForEvent: async (eventId, formResponses = []) => {
    const response = await api.post(`/registrations/event/${eventId}`, { formResponses });
    return response.data;
  },

  /**
   * Purchase merchandise
   */
  purchaseMerchandise: async (eventId, variantId, quantity = 1) => {
    const response = await api.post(`/registrations/merchandise/${eventId}`, {
      variantId,
      quantity
    });
    return response.data;
  },

  /**
   * Get my registrations
   */
  getMyRegistrations: async (params = {}) => {
    const response = await api.get('/registrations/my-registrations', { params });
    return response.data;
  },

  /**
   * Get single registration (ticket)
   */
  getRegistration: async (id) => {
    const response = await api.get(`/registrations/${id}`);
    return response.data;
  },

  /**
   * Cancel registration
   */
  cancelRegistration: async (id) => {
    const response = await api.put(`/registrations/${id}/cancel`);
    return response.data;
  },

  /**
   * Get event registrations (for organizers)
   */
  getEventRegistrations: async (eventId, params = {}) => {
    const response = await api.get(`/registrations/event/${eventId}`, { params });
    return response.data;
  },

  /**
   * Export registrations to CSV
   */
  exportRegistrations: async (eventId) => {
    const response = await api.get(`/registrations/event/${eventId}/export`, {
      responseType: 'blob'
    });
    return response.data;
  },

  /**
   * Mark attendance
   */
  markAttendance: async (registrationId) => {
    const response = await api.put(`/registrations/${registrationId}/attend`);
    return response.data;
  }
  ,
  getOrganizerRegistrations: async () => {
    const response = await api.get('/registrations/organizer/all');
    return response.data;
  },
  uploadPaymentProof: async (registrationId, file) => {
    const form = new FormData();
    form.append('paymentProof', file);
    const response = await api.put(`/registrations/${registrationId}/payment-proof`, form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  }
};

export default registrationService;
