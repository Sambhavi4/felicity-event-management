/**
 * Notification Model
 * 
 * In-app notification system for real-time updates:
 * - New discussion messages / announcements
 * - Registration confirmations  
 * - Payment status updates
 * - Event updates
 */

import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['discussion_message', 'discussion_reply', 'announcement', 'registration', 'payment_update', 'event_update', 'attendance'],
    required: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    maxlength: 500
  },
  // Link to relevant page
  link: {
    type: String,
    default: null
  },
  // Related entities
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  read: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 }); // auto-delete after 30 days

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
