/**
 * Team Service
 * Handles hackathon team operations
 */

import api from './api';

const teamService = {
  /**
   * Create a team
   */
  createTeam: async (eventId, teamName, teamSize) => {
    const response = await api.post(`/teams/event/${eventId}`, {
      teamName,
      teamSize
    });
    return response.data;
  },

  /**
   * Join a team via invite code
   */
  joinTeam: async (inviteCode) => {
    const response = await api.post(`/teams/join/${inviteCode}`);
    return response.data;
  },

  /**
   * Get my teams
   */
  getMyTeams: async () => {
    const response = await api.get('/teams/my-teams');
    return response.data;
  },

  /**
   * Get team details
   */
  getTeam: async (id) => {
    const response = await api.get(`/teams/${id}`);
    return response.data;
  },

  /**
   * Leave a team
   */
  leaveTeam: async (id) => {
    const response = await api.delete(`/teams/${id}/leave`);
    return response.data;
  },

  /**
   * Delete a team (leader only)
   */
  deleteTeam: async (id) => {
    const response = await api.delete(`/teams/${id}`);
    return response.data;
  },

  /**
   * Get calendar export link
   */
  getCalendarLinks: async (registrationId) => {
    const response = await api.get(`/registrations/${registrationId}/calendar-links`);
    return response.data;
  },

  /**
   * Export to calendar (download .ics)
   */
  exportToCalendar: (registrationId) => {
    return `/api/registrations/${registrationId}/calendar`;
  },

  /**
   * Batch export to calendar
   */
  exportBatchToCalendar: async (registrationIds) => {
    const response = await api.post('/registrations/calendar/batch', {
      registrationIds
    }, {
      responseType: 'blob'
    });
    return response.data;
  }
};

export default teamService;
