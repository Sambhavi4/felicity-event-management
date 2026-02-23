/**
 * Admin Controller
 * 
 * HANDLES:
 * - Organizer account management (create, disable, remove)
 * - Password reset requests (Tier B feature)
 * - System-wide analytics
 * 
 * SECURITY:
 * - All routes require admin role
 * - Auto-generates secure passwords for organizers
 * - Audit logging for sensitive operations
 */

import User from '../models/User.js';
import Event from '../models/Event.js';
import Registration from '../models/Registration.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { sendOrganizerCredentials } from '../utils/email.js';
import crypto from 'crypto';
import PasswordReset from '../models/PasswordReset.js';

/**
 * Generate random password
 */
const generatePassword = (length = 12) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

/**
 * @desc    Create new organizer account
 * @route   POST /api/admin/organizers
 * @access  Private (Admin)
 * 
 * WORKFLOW:
 * 1. Validate organizer details
 * 2. Generate login email and password
 * 3. Create account
 * 4. Send credentials via email
 */
export const createOrganizer = asyncHandler(async (req, res, next) => {
  const { organizerName, category, description, contactEmail } = req.body;
  
  // Validate required fields
  if (!organizerName || !category) {
    throw new AppError('Organizer name and category are required', 400);
  }
  
  // Auto-generate email in format: <slug>-iiit@clubs.iiit.ac.in
  // Make slug URL-safe and if a collision occurs, append a numeric suffix: slug, slug-1, slug-2 ...
  const baseSlug = organizerName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  let emailSlug = baseSlug || `org-${crypto.randomBytes(3).toString('hex')}`;
  let email;
  let attempt = 0;
  while (true) {
    email = `${emailSlug}-iiit@clubs.iiit.ac.in`;
    // Check if email already exists (prevents duplicate club names)
    // Use a lean query for speed
    // eslint-disable-next-line no-await-in-loop
    const existingUser = await User.findOne({ email }).select('_id');
    if (!existingUser) break;
    attempt += 1;
    // append numeric suffix to make unique
    emailSlug = `${baseSlug}-${attempt}`;
    if (attempt > 200) {
      throw new AppError('Unable to generate a unique organizer email; try a different name', 500);
    }
  }
  
  // Generate password
  const password = generatePassword();
  
  // Create organizer
  const organizer = await User.create({
    email,
    password,
    role: 'organizer',
    organizerName,
    category,
    description,
    contactEmail: contactEmail || email,
    isActive: true
  });
  
  // Enqueue credentials email. If admin provided a contactEmail, send credentials to that address
  try {
    const sendTo = contactEmail || email;
    const html = `<p>Hi <strong>${organizerName}</strong>,</p><p>Your organizer account has been created. Login email: <strong>${email}</strong></p><p>Temporary password: <strong>${password}</strong></p>`;
    await (await import('../services/emailService.js')).default.enqueue({ to: sendTo, subject: `Your Organizer Account — Felicity`, html });
  } catch (emailError) {
    console.error('Failed to enqueue organizer credentials email:', emailError);
  }
  
  res.status(201).json({
    success: true,
    message: 'Organizer account created',
    organizer: {
      id: organizer._id,
      email: organizer.email,
      contactEmail: organizer.contactEmail,
      organizerName: organizer.organizerName,
      category: organizer.category,
      // Only show password in response for admin to share manually
      temporaryPassword: password
    }
  });
});

/**
 * @desc    Get all organizers
 * @route   GET /api/admin/organizers
 * @access  Private (Admin)
 */
export const getOrganizers = asyncHandler(async (req, res, next) => {
  const { status, category, search, page = 1, limit = 20 } = req.query;
  
  const query = { role: 'organizer' };
  
  if (status === 'active') {
    query.isActive = true;
  } else if (status === 'inactive') {
    query.isActive = false;
  }
  
  if (category) {
    query.category = category;
  }
  
  if (search) {
    query.$or = [
      { organizerName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }
  
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const organizers = await User.find(query)
    .select('-password')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));
  
  const total = await User.countDocuments(query);
  
  // Get event counts for each organizer
  const organizersWithStats = await Promise.all(
    organizers.map(async (org) => {
      const eventCount = await Event.countDocuments({ organizer: org._id });
      return {
        ...org.toObject(),
        eventCount
      };
    })
  );
  
  res.status(200).json({
    success: true,
    count: organizers.length,
    total,
    pages: Math.ceil(total / parseInt(limit)),
    organizers: organizersWithStats
  });
});

/**
 * @desc    Get single organizer
 * @route   GET /api/admin/organizers/:id
 * @access  Private (Admin)
 */
export const getOrganizer = asyncHandler(async (req, res, next) => {
  const organizer = await User.findById(req.params.id).select('-password');
  
  if (!organizer || organizer.role !== 'organizer') {
    throw new AppError('Organizer not found', 404);
  }
  
  // Get organizer's events
  const events = await Event.find({ organizer: organizer._id })
    .select('name eventType status registrationCount')
    .sort({ createdAt: -1 })
    .limit(10);
  
  res.status(200).json({
    success: true,
    organizer,
    recentEvents: events
  });
});

/**
 * @desc    Update organizer
 * @route   PUT /api/admin/organizers/:id
 * @access  Private (Admin)
 */
export const updateOrganizer = asyncHandler(async (req, res, next) => {
  const { organizerName, category, description, contactEmail, isActive } = req.body;
  
  const organizer = await User.findById(req.params.id);
  
  if (!organizer || organizer.role !== 'organizer') {
    throw new AppError('Organizer not found', 404);
  }
  
  // Update fields
  if (organizerName) organizer.organizerName = organizerName;
  if (category) organizer.category = category;
  if (description !== undefined) organizer.description = description;
  if (contactEmail) organizer.contactEmail = contactEmail;
  if (isActive !== undefined) organizer.isActive = isActive;
  
  await organizer.save();
  
  res.status(200).json({
    success: true,
    message: 'Organizer updated',
    organizer: organizer.getPublicProfile()
  });
});

/**
 * @desc    Disable/Enable organizer account
 * @route   PUT /api/admin/organizers/:id/toggle-status
 * @access  Private (Admin)
 */
export const toggleOrganizerStatus = asyncHandler(async (req, res, next) => {
  const organizer = await User.findById(req.params.id);
  
  if (!organizer || organizer.role !== 'organizer') {
    throw new AppError('Organizer not found', 404);
  }
  
  organizer.isActive = !organizer.isActive;
  await organizer.save();
  
  res.status(200).json({
    success: true,
    message: `Organizer ${organizer.isActive ? 'activated' : 'deactivated'}`,
    isActive: organizer.isActive
  });
});

/**
 * @desc    Delete organizer (archive)
 * @route   DELETE /api/admin/organizers/:id
 * @access  Private (Admin)
 * 
 * OPTIONS:
 * - ?permanent=true: Permanently delete
 * - Default: Archive (deactivate)
 */
export const deleteOrganizer = asyncHandler(async (req, res, next) => {
  const { permanent } = req.query;
  
  const organizer = await User.findById(req.params.id);
  
  if (!organizer || organizer.role !== 'organizer') {
    throw new AppError('Organizer not found', 404);
  }
  
  if (permanent === 'true') {
    // CASCADE DELETE: Delete all events and associated data (per clarification doc)
    const events = await Event.find({ organizer: organizer._id });
    const eventIds = events.map(e => e._id);
    
    // Delete all registrations for these events
    if (eventIds.length > 0) {
      await Registration.deleteMany({ event: { $in: eventIds } });
    }
    
    // Delete all events
    await Event.deleteMany({ organizer: organizer._id });
    
    // Delete the organizer
    await organizer.deleteOne();
    
    res.status(200).json({
      success: true,
      message: `Organizer permanently deleted along with ${events.length} events and associated data`
    });
  } else {
    // Archive (deactivate)
    organizer.isActive = false;
    await organizer.save();
    
    res.status(200).json({
      success: true,
      message: 'Organizer archived (deactivated)'
    });
  }
});

/**
 * @desc    Reset organizer password
 * @route   POST /api/admin/organizers/:id/reset-password
 * @access  Private (Admin)
 */
export const resetOrganizerPassword = asyncHandler(async (req, res, next) => {
  const organizer = await User.findById(req.params.id);
  
  if (!organizer || organizer.role !== 'organizer') {
    throw new AppError('Organizer not found', 404);
  }
  
  // Generate new password
  const newPassword = generatePassword();
  organizer.password = newPassword;
  organizer.passwordResetRequested = false;
  await organizer.save();
  
  // Send new credentials
  try {
  await sendOrganizerCredentials(organizer.email, newPassword, organizer.organizerName, organizer.contactEmail);
  } catch (emailError) {
    console.error('Failed to send new credentials:', emailError);
  }
  
  // Record in password reset history
  try {
    await PasswordReset.create({
      organizer: organizer._id,
      requestedBy: 'admin',
      status: 'Approved',
      temporaryPassword: newPassword,
      actionedAt: new Date()
    });
  } catch (err) {
    console.error('Failed to record password reset history:', err);
  }

  res.status(200).json({
    success: true,
    message: 'Password reset successful',
    temporaryPassword: newPassword
  });
});


/**
 * @desc    Approve or reject a password reset request
 * @route   PUT /api/admin/password-reset/:id/action
 * @access  Private (Admin)
 */
export const actionPasswordResetRequest = asyncHandler(async (req, res, next) => {
  const { action, comment } = req.body; // action = 'approve' | 'reject'
  const reqDoc = await PasswordReset.findById(req.params.id).populate('organizer');
  if (!reqDoc) throw new AppError('Password reset request not found', 404);

  if (reqDoc.status !== 'Pending') {
    throw new AppError('Request already actioned', 400);
  }

  if (action === 'approve') {
    // generate new password and update organizer
    const newPassword = generatePassword();
    const organizer = await User.findById(reqDoc.organizer._id);
    organizer.password = newPassword;
    organizer.passwordResetRequested = false;
    await organizer.save();

    // send credentials to organizer
    try {
  await sendOrganizerCredentials(organizer.email, newPassword, organizer.organizerName, organizer.contactEmail);
    } catch (emailError) {
      console.error('Failed to send approved credentials:', emailError);
    }

    reqDoc.status = 'Approved';
    reqDoc.adminComment = comment || '';
    reqDoc.temporaryPassword = newPassword;
    reqDoc.actionedAt = new Date();
    await reqDoc.save();

    return res.status(200).json({ success: true, message: 'Password reset approved', temporaryPassword: newPassword });
  }

  if (action === 'reject') {
    reqDoc.status = 'Rejected';
    reqDoc.adminComment = comment || '';
    reqDoc.actionedAt = new Date();
    await reqDoc.save();
    // clear organizer flag
    const organizer = await User.findById(reqDoc.organizer._id);
    if (organizer) {
      organizer.passwordResetRequested = false;
      await organizer.save();
    }
    return res.status(200).json({ success: true, message: 'Password reset request rejected' });
  }

  throw new AppError('Unknown action', 400);
});


/**
 * @desc    Get password reset history (for admin)
 * @route   GET /api/admin/password-reset-history
 * @access  Private (Admin)
 */
export const getPasswordResetHistory = asyncHandler(async (req, res, next) => {
  const docs = await PasswordReset.find()
    .populate('organizer', 'organizerName email')
    .sort({ requestedAt: -1 })
    .limit(200);

  res.status(200).json({ success: true, count: docs.length, history: docs });
});

/**
 * @desc    Get password reset requests (Tier B Feature)
 * @route   GET /api/admin/password-reset-requests
 * @access  Private (Admin)
 */
export const getPasswordResetRequests = asyncHandler(async (req, res, next) => {
  const requests = await User.find({
    role: 'organizer',
    passwordResetRequested: true
  })
    .select('email organizerName passwordResetRequestDate')
    .sort({ passwordResetRequestDate: -1 });
  
  res.status(200).json({
    success: true,
    count: requests.length,
    requests
  });
});

/**
 * @desc    Get dashboard stats
 * @route   GET /api/admin/stats
 * @access  Private (Admin)
 */
export const getDashboardStats = asyncHandler(async (req, res, next) => {
  // Parallel queries for efficiency
  const [
    totalParticipants,
    totalOrganizers,
    activeOrganizers,
    totalEvents,
    publishedEvents,
    totalRegistrations
  ] = await Promise.all([
    User.countDocuments({ role: 'participant' }),
    User.countDocuments({ role: 'organizer' }),
    User.countDocuments({ role: 'organizer', isActive: true }),
    Event.countDocuments(),
    Event.countDocuments({ status: 'published' }),
    Registration.countDocuments()
  ]);
  
  // Events by status
  const eventsByStatus = await Event.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  
  // Recent registrations
  const recentRegistrations = await Registration.find()
    .populate('participant', 'firstName lastName')
    .populate('event', 'name')
    .sort({ createdAt: -1 })
    .limit(5);
  
  res.status(200).json({
    success: true,
    stats: {
      users: {
        participants: totalParticipants,
        organizers: totalOrganizers,
        activeOrganizers
      },
      events: {
        total: totalEvents,
        published: publishedEvents,
        byStatus: eventsByStatus.reduce((acc, s) => {
          acc[s._id] = s.count;
          return acc;
        }, {})
      },
      registrations: {
        total: totalRegistrations
      }
    },
    recentRegistrations
  });
});
