/**
 * Discussion Routes (Tier B Feature)
 * 
 * BASE: /api/discussions
 */

import express from 'express';
import {
  postMessage,
  getMessages,
  deleteMessage,
  togglePinMessage,
  reactToMessage
} from '../controllers/discussionController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.route('/:eventId')
  .get(protect, getMessages)
  .post(protect, postMessage);

router.delete('/:eventId/:messageId', protect, deleteMessage);
router.put('/:eventId/:messageId/pin', protect, togglePinMessage);
router.post('/:eventId/:messageId/react', protect, reactToMessage);

export default router;
