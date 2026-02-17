import express from 'express';
import Registration from '../models/Registration.js';

const router = express.Router();

// Public debug endpoint: list a few registrations with paymentProof
// NOTE: This is for quick verification only. Remove or protect in production if needed.
router.get('/registrations-sample', async (req, res) => {
  try {
    const items = await Registration.find({}, { ticketId: 1, paymentProof: 1 }).limit(10).lean();
    res.json({ success: true, count: items.length, items });
  } catch (e) {
    console.error('Debug endpoint error', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
