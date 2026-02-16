/**
 * Team Controller
 * Handles hackathon team registration with invite system
 */

import Team from '../models/Team.js';
import Event from '../models/Event.js';
import Registration from '../models/Registration.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { generateTicketQR } from '../utils/qrcode.js';

/**
 * @desc    Create a team for team-based event
 * @route   POST /api/teams/event/:eventId
 * @access  Private (Participant)
 */
export const createTeam = asyncHandler(async (req, res, next) => {
  const { eventId } = req.params;
  const { teamName, teamSize } = req.body;
  
  const event = await Event.findById(eventId);
  if (!event) throw new AppError('Event not found', 404);
  if (!event.isTeamEvent) throw new AppError('This event does not support teams', 400);
  if (teamSize < event.minTeamSize || teamSize > event.maxTeamSize) {
    throw new AppError(`Team size must be between ${event.minTeamSize} and ${event.maxTeamSize}`, 400);
  }
  
  // Check if user already has a team for this event
  const existing = await Team.findOne({
    event: eventId,
    $or: [
      { teamLeader: req.user.id },
      { 'members.user': req.user.id, 'members.status': { $in: ['pending', 'accepted'] } }
    ]
  });
  
  if (existing) throw new AppError('You already have a team for this event', 400);
  
  const team = await Team.create({
    event: eventId,
    teamName,
    teamLeader: req.user.id,
    teamSize
  });
  
  await team.populate('teamLeader', 'firstName lastName email');
  
  res.status(201).json({
    success: true,
    team
  });
});

/**
 * @desc    Join a team via invite code
 * @route   POST /api/teams/join/:inviteCode
 * @access  Private (Participant)
 */
export const joinTeam = asyncHandler(async (req, res, next) => {
  const { inviteCode } = req.params;
  
  const team = await Team.findOne({ inviteCode }).populate('event');
  if (!team) throw new AppError('Invalid invite code', 404);
  if (team.isComplete) throw new AppError('Team is already complete', 400);
  
  // Check if already in team
  const alreadyMember = team.members.find(m => 
    m.user.toString() === req.user.id && m.status !== 'declined'
  );
  if (alreadyMember) throw new AppError('You are already in this team', 400);
  if (team.teamLeader.toString() === req.user.id) throw new AppError('You are the team leader', 400);
  
  // Check if user already in another team for same event
  const otherTeam = await Team.findOne({
    event: team.event._id,
    _id: { $ne: team._id },
    $or: [
      { teamLeader: req.user.id },
      { 'members.user': req.user.id, 'members.status': { $in: ['pending', 'accepted'] } }
    ]
  });
  if (otherTeam) throw new AppError('You are already in another team for this event', 400);
  
  // Check if team is full
  const acceptedCount = team.members.filter(m => m.status === 'accepted').length;
  if (acceptedCount >= team.teamSize - 1) throw new AppError('Team is full', 400);
  
  // Add member
  team.members.push({
    user: req.user.id,
    status: 'accepted',
    respondedAt: new Date()
  });
  
  team.checkComplete();
  await team.save();
  
  // If team complete, create registrations for ALL members (leader + accepted members)
  if (team.isComplete) {
    const allMemberIds = [
      team.teamLeader,
      ...team.members.filter(m => m.status === 'accepted').map(m => m.user)
    ];
    
    const registrationIds = [];
    for (const memberId of allMemberIds) {
      // Skip if a registration already exists (idempotency)
      const existing = await Registration.findOne({ event: team.event._id, participant: memberId });
      if (existing) {
        registrationIds.push(existing._id);
        continue;
      }
      
      const memberUser = await (await import('../models/User.js')).default.findById(memberId);
      const registration = await Registration.create({
        event: team.event._id,
        participant: memberId,
        registrationType: 'normal',
        team: team._id,
        status: 'confirmed'
      });
      
      // Generate individual QR code for each member
      const qrCodeData = await generateTicketQR(registration, team.event, memberUser);
      registration.qrCodeData = qrCodeData;
      await registration.save();
      
      registrationIds.push(registration._id);
      
      // Send confirmation email to each member
      try {
        const html = `<p>Hi <strong>${memberUser?.firstName || 'Team Member'}</strong>,</p>
          <p>Your team <strong>${team.teamName}</strong> is now complete for <strong>${team.event.name}</strong>!</p>
          <p>Your ticket has been generated. Ticket ID: <strong>${registration.ticketId}</strong></p>`;
        await (await import('../services/emailService.js')).default.enqueue({
          to: memberUser?.email,
          subject: `🎉 Team Complete — ${team.event.name}`,
          html
        });
      } catch (emailErr) {
        console.error('Failed to send team completion email:', emailErr);
      }
    }
    
    // Increment registration count for all new members
    await Event.findByIdAndUpdate(team.event._id, {
      $inc: { registrationCount: allMemberIds.length }
    });
    
    // Push recent registration timestamps for trending
    const timestamps = allMemberIds.map(() => ({ timestamp: new Date() }));
    Event.updateOne({ _id: team.event._id }, { $push: { recentRegistrations: { $each: timestamps, $slice: -200 } } }).exec();
    
    // Store leader's registration as the team's primary registration
    team.registrationId = registrationIds[0];
    await team.save();
  }
  
  await team.populate(['teamLeader', 'members.user']);
  
  res.status(200).json({
    success: true,
    team,
    message: team.isComplete ? 'Team complete! Registration created.' : 'Joined team successfully'
  });
});

/**
 * @desc    Get my teams
 * @route   GET /api/teams/my-teams
 * @access  Private (Participant)
 */
export const getMyTeams = asyncHandler(async (req, res, next) => {
  const teams = await Team.find({
    $or: [
      { teamLeader: req.user.id },
      { 'members.user': req.user.id }
    ]
  }).populate('event', 'name eventStartDate')
    .populate('teamLeader', 'firstName lastName email')
    .populate('members.user', 'firstName lastName email')
    .sort('-createdAt');
  
  res.status(200).json({
    success: true,
    count: teams.length,
    teams
  });
});

/**
 * @desc    Get team details
 * @route   GET /api/teams/:id
 * @access  Private (Participant or Organizer)
 */
export const getTeam = asyncHandler(async (req, res, next) => {
  const team = await Team.findById(req.params.id)
    .populate('event', 'name eventStartDate organizer')
    .populate('teamLeader', 'firstName lastName email')
    .populate('members.user', 'firstName lastName email')
    .populate('registrationId');
  
  if (!team) throw new AppError('Team not found', 404);
  
  // Check access
  const isLeader = team.teamLeader._id.toString() === req.user.id;
  const isMember = team.members.some(m => m.user._id.toString() === req.user.id);
  const isOrganizer = team.event.organizer.toString() === req.user.id;
  
  if (!isLeader && !isMember && !isOrganizer && req.user.role !== 'admin') {
    throw new AppError('Not authorized to view this team', 403);
  }
  
  res.status(200).json({
    success: true,
    team
  });
});

/**
 * @desc    Leave team (before completion)
 * @route   DELETE /api/teams/:id/leave
 * @access  Private (Participant)
 */
export const leaveTeam = asyncHandler(async (req, res, next) => {
  const team = await Team.findById(req.params.id);
  if (!team) throw new AppError('Team not found', 404);
  if (team.isComplete) throw new AppError('Cannot leave completed team', 400);
  if (team.teamLeader.toString() === req.user.id) {
    throw new AppError('Team leader cannot leave. Delete the team instead.', 400);
  }
  
  const memberIndex = team.members.findIndex(m => m.user.toString() === req.user.id);
  if (memberIndex === -1) throw new AppError('You are not in this team', 400);
  
  team.members.splice(memberIndex, 1);
  await team.save();
  
  res.status(200).json({
    success: true,
    message: 'Left team successfully'
  });
});

/**
 * @desc    Delete team (leader only, before completion)
 * @route   DELETE /api/teams/:id
 * @access  Private (Participant - Team Leader)
 */
export const deleteTeam = asyncHandler(async (req, res, next) => {
  const team = await Team.findById(req.params.id);
  if (!team) throw new AppError('Team not found', 404);
  if (team.teamLeader.toString() !== req.user.id) {
    throw new AppError('Only team leader can delete team', 403);
  }
  if (team.isComplete) throw new AppError('Cannot delete completed team', 400);
  
  await team.deleteOne();
  
  res.status(200).json({
    success: true,
    message: 'Team deleted successfully'
  });
});

export default {
  createTeam,
  joinTeam,
  getMyTeams,
  getTeam,
  leaveTeam,
  deleteTeam
};
