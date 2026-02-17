/**
 * API Service
 * 
 * Centralized API client using Axios
 * 
 * FEATURES:
 * - Base URL configuration
 * - Automatic token attachment
 * - Response/error interceptors
 * - Token refresh handling
 */

import axios from 'axios';

// Create axios instance with defaults
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 30000 // 30 second timeout (payment actions & file uploads need more time)
});

/**
 * Request Interceptor
 * 
 * PURPOSE:
 * - Attach JWT token to every request
 * - No need to manually add Authorization header
 */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response Interceptor
 * 
 * PURPOSE:
 * - Handle common error responses
 * - Auto-logout on 401 (token expired)
 * - Standardize error format
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Additional debug logging for client-side errors
    try {
      console.error('API error intercepted:', {
        message: error.message,
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        responseData: error.response?.data
      });
    } catch (e) {
      console.error('Failed to log API error', e);
    }
    if (error.response) {
      // Handle 401 Unauthorized
      if (error.response.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Redirect to login (only if not already on login page)
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
      
      // Extract error message
      const message = error.response.data?.message || 'An error occurred';
      error.message = message;
    } else if (error.request) {
      // Request made but no response
      error.message = 'Network error. Please check your connection.';
    }
    
    return Promise.reject(error);
  }
);

/**
 * Resolve an upload path (e.g. /uploads/file.jpg) to a full URL.
 * In development the Vite proxy handles /uploads, but in production
 * the frontend and backend are on different domains so we need the
 * full backend URL.
 */
export const getUploadUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path; // already absolute
  const apiUrl = import.meta.env.VITE_API_URL || '/api';
  if (apiUrl.startsWith('http')) {
    // Strip trailing /api to get the backend origin
    return apiUrl.replace(/\/api\/?$/, '') + path;
  }
  // Relative — works in dev with Vite proxy
  return path;
};

export default api;
