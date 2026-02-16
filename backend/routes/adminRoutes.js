/**
 * Admin Routes
 * 
 * BASE: /api/admin
 * 
 * All routes require admin authentication
 */

import express from 'express';
import {
  createOrganizer,
  getOrganizers,
  getOrganizer,
  updateOrganizer,
  toggleOrganizerStatus,
  deleteOrganizer,
  resetOrganizerPassword,
  actionPasswordResetRequest,
  getPasswordResetHistory,
  getPasswordResetRequests,
  getDashboardStats
} from '../controllers/adminController.js';
import { protect, authorize } from '../middleware/auth.js';
import sendEmail from '../utils/email.js';

const router = express.Router();

// Dev helper: send test email to address (only in non-production)
// Placed before auth middleware so it can be used without a token during local development.
if (process.env.NODE_ENV !== 'production') {
  router.post('/send-test-email', async (req, res) => {
    const { to } = req.body;
    if (!to) return res.status(400).json({ success: false, message: 'Please provide to email' });
    try {
      const info = await sendEmail({ to, subject: 'Felicity Test Email', html: `<p>This is a test email from Felicity</p>` });
      return res.status(200).json({ success: true, info: info || null });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message || 'Failed to send' });
    }
  });
  // Enqueue many test emails for load testing
  router.post('/enqueue-test-emails', async (req, res) => {
    const { count = 100 } = req.body;
    try {
      const svc = await import('../services/emailService.js');
      for (let i = 0; i < count; i++) {
        await svc.default.enqueue({ to: `dev+${Date.now()}+${i}@example.com`, subject: `Felicity Dev Email ${i+1}`, html: `<p>Dev email ${i+1}</p>` });
      }
      return res.status(200).json({ success: true, enqueued: count });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message || 'Failed' });
    }
  });
}

// All routes require admin role
router.use(protect);
router.use(authorize('admin'));

// Dashboard
router.get('/stats', getDashboardStats);

// Email queue administration
router.get('/email-queue', async (req, res) => {
  try {
    const EmailQueue = (await import('../models/EmailQueue.js')).default;
    const items = await EmailQueue.find().sort({ createdAt: -1 }).limit(200);
    return res.status(200).json({ success: true, items });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || 'Failed' });
  }
});

router.get('/email-queue/stats', async (req, res) => {
  try {
    const EmailQueue = (await import('../models/EmailQueue.js')).default;
    const total = await EmailQueue.countDocuments();
    const pending = await EmailQueue.countDocuments({ status: 'pending' });
    const processing = await EmailQueue.countDocuments({ status: 'processing' });
    const sent = await EmailQueue.countDocuments({ status: 'sent' });
    const failed = await EmailQueue.countDocuments({ status: 'failed' });
    return res.status(200).json({ success: true, stats: { total, pending, processing, sent, failed } });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || 'Failed' });
  }
});

router.get('/email-queue/:id', async (req, res) => {
  try {
    const EmailQueue = (await import('../models/EmailQueue.js')).default;
    const item = await EmailQueue.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    return res.status(200).json({ success: true, item });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || 'Failed' });
  }
});

router.post('/email-queue/:id/retry', async (req, res) => {
  try {
    const EmailQueue = (await import('../models/EmailQueue.js')).default;
    const item = await EmailQueue.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    item.status = 'pending';
    item.lastError = undefined;
    await item.save();
    return res.status(200).json({ success: true, message: 'Re-queued' });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || 'Failed' });
  }
});

router.post('/email-queue/:id/send-now', async (req, res) => {
  try {
    const svc = await import('../services/emailService.js');
    const item = await svc.default.processOne(req.params.id);
    return res.status(200).json({ success: true, item });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || 'Failed' });
  }
});

router.delete('/email-queue/:id', async (req, res) => {
  try {
    const EmailQueue = (await import('../models/EmailQueue.js')).default;
    const item = await EmailQueue.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    return res.status(200).json({ success: true, message: 'Deleted' });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || 'Failed' });
  }
});

// Dev helper: send test email to address (only in non-production)
router.post('/send-test-email', async (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(403).json({ success: false, message: 'Not allowed in production' });
  const { to } = req.body;
  if (!to) return res.status(400).json({ success: false, message: 'Please provide to email' });
  try {
    const info = await sendEmail({ to, subject: 'Felicity Test Email', html: `<p>This is a test email from Felicity</p>` });
    return res.status(200).json({ success: true, info: info || null });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || 'Failed to send' });
  }
});

// Organizer management
router.route('/organizers')
  .get(getOrganizers)
  .post(createOrganizer);

router.route('/organizers/:id')
  .get(getOrganizer)
  .put(updateOrganizer)
  .delete(deleteOrganizer);

router.put('/organizers/:id/toggle-status', toggleOrganizerStatus);
router.post('/organizers/:id/reset-password', resetOrganizerPassword);

// Password reset actions
router.put('/password-reset/:id/action', actionPasswordResetRequest);
router.get('/password-reset-history', getPasswordResetHistory);

// Password reset requests
router.get('/password-reset-requests', getPasswordResetRequests);

export default router;
