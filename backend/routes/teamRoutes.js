import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
  createTeam,
  joinTeam,
  getMyTeams,
  getTeam,
  leaveTeam,
  deleteTeam
} from '../controllers/teamController.js';

const router = express.Router();

router.use(protect);

// Participant-only routes
router.post('/event/:eventId', authorize('participant'), createTeam);
router.post('/join/:inviteCode', authorize('participant'), joinTeam);
router.get('/my-teams', authorize('participant'), getMyTeams);
router.delete('/:id/leave', authorize('participant'), leaveTeam);
router.delete('/:id', authorize('participant'), deleteTeam);

// Allow organizers and admins to view team details
router.get('/:id', authorize('participant', 'organizer', 'admin'), getTeam);

export default router;
