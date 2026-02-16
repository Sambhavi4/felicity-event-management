/**
 * Registration Routes
 * 
 * BASE: /api/registrations
 */

import express from 'express';
import {
  registerForEvent,
  purchaseMerchandise,
  getMyRegistrations,
  getRegistration,
  cancelRegistration,
  getEventRegistrations,
  exportRegistrations,
  markAttendance,
  uploadPaymentProof,
  paymentAction,
  scanQRCode,
  getAttendanceDashboard,
  manualAttendanceOverride,
  exportToCalendar,
  exportBatchToCalendar,
  getCalendarLinks,
  getOrganizerRegistrations
} from '../controllers/registrationController.js';
import { protect, authorize } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// Event-specific routes (must come before /:id to avoid conflict)
router.post('/event/:eventId', protect, authorize('participant'), registerForEvent);
router.post('/merchandise/:eventId', protect, authorize('participant'), purchaseMerchandise);
router.get('/event/:eventId/export', protect, authorize('organizer', 'admin'), exportRegistrations);
router.get('/event/:eventId/attendance', protect, authorize('organizer', 'admin'), getAttendanceDashboard);
router.get('/event/:eventId', protect, authorize('organizer', 'admin'), getEventRegistrations);

// Participant routes
router.get('/my-registrations', protect, authorize('participant'), getMyRegistrations);
router.post('/scan-qr', protect, authorize('organizer', 'admin'), scanQRCode);
router.get('/organizer/all', protect, authorize('organizer', 'admin'), getOrganizerRegistrations);
router.post('/calendar/batch', protect, authorize('participant'), exportBatchToCalendar);
router.get('/:id', protect, getRegistration);
router.get('/:id/calendar', protect, authorize('participant'), exportToCalendar);
router.get('/:id/calendar-links', protect, authorize('participant'), getCalendarLinks);
router.put('/:id/cancel', protect, authorize('participant'), cancelRegistration);
router.put('/:id/payment-proof', protect, authorize('participant'), upload.single('paymentProof'), uploadPaymentProof);

// Organizer routes
router.put('/:id/attend', protect, authorize('organizer', 'admin'), markAttendance);
router.put('/:id/payment-action', protect, authorize('organizer', 'admin'), paymentAction);
router.put('/:id/manual-attend', protect, authorize('organizer', 'admin'), manualAttendanceOverride);

export default router;
