import express from 'express';
import Registration from '../models/Registration.js';
import fs from 'fs';
import { execSync } from 'child_process';

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

router.get('/version', (req, res) => {
  try {
    let commit = process.env.COMMIT_SHA || null;
    try {
      if (!commit && fs.existsSync('.git')) {
        commit = execSync('git rev-parse --short HEAD').toString().trim();
      }
    } catch (e) {
      // ignore
    }
    const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    res.json({ success: true, version: pkg.version || null, commit });
  } catch (e) {
    res.status(500).json({ success: false, message: 'version info unavailable' });
  }
});

export default router;
