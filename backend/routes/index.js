/**
 * Routes Index
 * 
 * Aggregates all route modules
 */

import authRoutes from './authRoutes.js';
import eventRoutes from './eventRoutes.js';
import registrationRoutes from './registrationRoutes.js';
import userRoutes from './userRoutes.js';
import adminRoutes from './adminRoutes.js';
import feedbackRoutes from './feedbackRoutes.js';
import discussionRoutes from './discussionRoutes.js';

export {
  authRoutes,
  eventRoutes,
  registrationRoutes,
  userRoutes,
  adminRoutes,
  feedbackRoutes,
  discussionRoutes
};
