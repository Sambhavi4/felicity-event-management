/**
 * Notification Service
 * Frontend API calls for in-app notifications
 */
import api from './api';

const notificationService = {
  getNotifications: async (params = {}) => {
    const response = await api.get('/notifications', { params });
    return response.data;
  },

  getUnreadCount: async () => {
    const response = await api.get('/notifications/unread-count');
    return response.data;
  },

  markAsRead: async (ids) => {
    const response = await api.put('/notifications/read', { ids });
    return response.data;
  },

  markAllRead: async () => {
    const response = await api.put('/notifications/read', { ids: 'all' });
    return response.data;
  },

  deleteNotification: async (id) => {
    const response = await api.delete(`/notifications/${id}`);
    return response.data;
  }
};

export default notificationService;
