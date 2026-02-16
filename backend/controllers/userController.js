/**
 * User Controller
 * 
 * HANDLES:
 * - Profile management
 * - User preferences
 * - Following organizers
 * - Organizer listing (public)
 */

import User from '../models/User.js';
import Event from '../models/Event.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import PasswordReset from '../models/PasswordReset.js';

/**
 * @desc    Update participant profile
 * @route   PUT /api/users/profile
 * @access  Private (Participant)
 * 
 * EDITABLE FIELDS:
 * - firstName, lastName
 * - contactNumber
 * - collegeName (non-IIIT only)
 * - interests
 * 
 * NON-EDITABLE:
 * - email
 * - participantType
 */
export const updateProfile = asyncHandler(async (req, res, next) => {
  const { firstName, lastName, contactNumber, collegeName, interests } = req.body;
  
  const user = await User.findById(req.user.id);
  
  if (!user) {
    throw new AppError('User not found', 404);
  }
  
  // Update allowed fields
  if (firstName) user.firstName = firstName;
  if (lastName !== undefined) user.lastName = lastName;
  if (contactNumber !== undefined) user.contactNumber = contactNumber;
  if (interests) user.interests = interests;
  
  // College name only editable for non-IIIT
  if (collegeName && user.participantType !== 'iiit') {
    user.collegeName = collegeName;
  }
  
  await user.save();
  
  res.status(200).json({
    success: true,
    message: 'Profile updated',
    user: user.getPublicProfile()
  });
});

/**
 * @desc    Update organizer profile
 * @route   PUT /api/users/organizer-profile
 * @access  Private (Organizer)
 */
export const updateOrganizerProfile = asyncHandler(async (req, res, next) => {
  const { organizerName, category, description, contactEmail, contactNumber, discordWebhook } = req.body;
  
  const user = await User.findById(req.user.id);
  
  if (!user || user.role !== 'organizer') {
    throw new AppError('Organizer not found', 404);
  }
  
  // Update fields
  if (organizerName) user.organizerName = organizerName;
  if (category) user.category = category;
  if (description !== undefined) user.description = description;
  if (contactEmail) user.contactEmail = contactEmail;
  if (contactNumber !== undefined) user.contactNumber = contactNumber;
  if (discordWebhook !== undefined) user.discordWebhook = discordWebhook;
  
  await user.save();
  
  res.status(200).json({
    success: true,
    message: 'Profile updated',
    user: user.getPublicProfile()
  });
});

/**
 * @desc    Get all organizers (public listing)
 * @route   GET /api/users/organizers
 * @access  Public
 */
export const getOrganizers = asyncHandler(async (req, res, next) => {
  const { category, search, page = 1, limit = 20 } = req.query;
  
  const query = { role: 'organizer', isActive: true };
  
  if (category) {
    query.category = category;
  }
  
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const fuzzyPattern = escaped.split('').join('.*');
    query.$or = [
      { organizerName: { $regex: fuzzyPattern, $options: 'i' } },
      { category: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }
  
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const organizers = await User.find(query)
    .select('organizerName category description contactEmail')
    .sort({ organizerName: 1 })
    .skip(skip)
    .limit(parseInt(limit));
  
  const total = await User.countDocuments(query);
  
  res.status(200).json({
    success: true,
    count: organizers.length,
    total,
    pages: Math.ceil(total / parseInt(limit)),
    organizers
  });
});

/**
 * @desc    Get single organizer (public)
 * @route   GET /api/users/organizers/:id
 * @access  Public
 */
export const getOrganizer = asyncHandler(async (req, res, next) => {
  const organizer = await User.findById(req.params.id)
    .select('organizerName category description contactEmail contactNumber role isActive');
  
  if (!organizer || organizer.role !== 'organizer' || !organizer.isActive) {
    throw new AppError('Organizer not found', 404);
  }
  
  // Get organizer's events
  const [upcomingEvents, pastEvents] = await Promise.all([
    Event.find({
      organizer: organizer._id,
      status: 'published',
      eventStartDate: { $gt: new Date() }
    })
      .select('name eventType eventStartDate registrationDeadline')
      .sort({ eventStartDate: 1 })
      .limit(5),
    
    Event.find({
      organizer: organizer._id,
      status: { $in: ['completed', 'closed'] }
    })
      .select('name eventType eventStartDate')
      .sort({ eventStartDate: -1 })
      .limit(5)
  ]);
  
  res.status(200).json({
    success: true,
    organizer,
    upcomingEvents,
    pastEvents
  });
});

/**
 * @desc    Follow an organizer
 * @route   POST /api/users/follow/:organizerId
 * @access  Private (Participant)
 */
export const followOrganizer = asyncHandler(async (req, res, next) => {
  const { organizerId } = req.params;
  
  // Verify organizer exists
  const organizer = await User.findById(organizerId);
  
  if (!organizer || organizer.role !== 'organizer') {
    throw new AppError('Organizer not found', 404);
  }
  
  // Add to followed list
  const user = await User.findById(req.user.id);
  
  if (user.followedOrganizers.includes(organizerId)) {
    throw new AppError('Already following this organizer', 400);
  }
  
  user.followedOrganizers.push(organizerId);
  await user.save();
  
  res.status(200).json({
    success: true,
    message: `Now following ${organizer.organizerName}`
  });
});

/**
 * @desc    Unfollow an organizer
 * @route   DELETE /api/users/follow/:organizerId
 * @access  Private (Participant)
 */
export const unfollowOrganizer = asyncHandler(async (req, res, next) => {
  const { organizerId } = req.params;
  
  const user = await User.findById(req.user.id);
  
  const index = user.followedOrganizers.indexOf(organizerId);
  
  if (index === -1) {
    throw new AppError('Not following this organizer', 400);
  }
  
  user.followedOrganizers.splice(index, 1);
  await user.save();
  
  res.status(200).json({
    success: true,
    message: 'Unfollowed organizer'
  });
});

/**
 * @desc    Get followed organizers
 * @route   GET /api/users/following
 * @access  Private (Participant)
 */
export const getFollowedOrganizers = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id)
    .populate('followedOrganizers', 'organizerName category description');
  
  res.status(200).json({
    success: true,
    count: user.followedOrganizers.length,
    organizers: user.followedOrganizers
  });
});

/**
 * @desc    Update interests
 * @route   PUT /api/users/interests
 * @access  Private (Participant)
 */
export const updateInterests = asyncHandler(async (req, res, next) => {
  const { interests } = req.body;
  
  if (!Array.isArray(interests)) {
    throw new AppError('Interests must be an array', 400);
  }
  
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { interests },
    { new: true }
  );
  
  res.status(200).json({
    success: true,
    message: 'Interests updated',
    interests: user.interests
  });
});

/**
 * @desc    Request password reset (for organizers - Tier B)
 * @route   POST /api/users/request-password-reset
 * @access  Private (Organizer)
 */
export const requestPasswordReset = asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'organizer') {
    throw new AppError('Only organizers can request password reset through admin', 400);
  }
  
  const { reason } = req.body;
  
  const user = await User.findById(req.user.id);
  user.passwordResetRequested = true;
  user.passwordResetRequestDate = new Date();
  await user.save();

  // Create a password reset request document
  try {
    await PasswordReset.create({
      organizer: user._id,
      requestedBy: 'organizer',
      reason: reason || ''
    });
  } catch (err) {
    console.error('Failed to create PasswordReset doc:', err);
  }

  res.status(200).json({
    success: true,
    message: 'Password reset request sent to admin'
  });
});
