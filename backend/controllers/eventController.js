/**
 * Event Controller
 * 
 * HANDLES:
 * - Event CRUD operations
 * - Event search and filtering
 * - Trending events
 * - Event analytics
 * 
 * ACCESS CONTROL:
 * - Create/Edit/Delete: Organizers (own events only)
 * - View: Public (published events) or Organizer (own drafts)
 * - Analytics: Organizer (own events)
 */

import Event from '../models/Event.js';
import Registration from '../models/Registration.js';
import User from '../models/User.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

/**
 * @desc    Create new event
 * @route   POST /api/events
 * @access  Private (Organizer)
 * 
 * WORKFLOW:
 * 1. Create event in 'draft' status
 * 2. Organizer can edit freely
 * 3. Publish when ready
 */
export const createEvent = asyncHandler(async (req, res, next) => {
  // Add organizer from authenticated user
  req.body.organizer = req.user.id;
  
  // Validate event type
  if (!['normal', 'merchandise'].includes(req.body.eventType)) {
    throw new AppError('Event type must be normal or merchandise', 400);
  }
  // Business rule validations: dates
  const { eventStartDate, eventEndDate, registrationDeadline } = req.body;
  if (eventStartDate && eventEndDate) {
    const start = new Date(eventStartDate);
    const end = new Date(eventEndDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new AppError('Invalid start or end date', 400);
    }
    if (end <= start) {
      throw new AppError('Event end date must be after start date', 400);
    }
  }
  if (registrationDeadline && eventStartDate) {
    const regDeadline = new Date(registrationDeadline);
    const start = new Date(eventStartDate);
    if (isNaN(regDeadline.getTime()) || isNaN(start.getTime())) {
      throw new AppError('Invalid registration deadline or start date', 400);
    }
    if (regDeadline >= start) {
      throw new AppError('Registration deadline must be before event start date', 400);
    }
  }
  
  // Create event
  const event = await Event.create(req.body);
  
  res.status(201).json({
    success: true,
    message: 'Event created as draft',
    event
  });
});

/**
 * @desc    Get all events (with filters)
 * @route   GET /api/events
 * @access  Public
 * 
 * QUERY PARAMETERS:
 * - search: Text search in name/description
 * - type: normal, merchandise
 * - eligibility: all, iiit-only, non-iiit-only
 * - startDate, endDate: Date range filter
 * - organizer: Filter by organizer ID
 * - tags: Comma-separated tags
 * - followed: 'true' to show only followed organizers' events
 * - page, limit: Pagination
 * 
 * OPTIMIZATION:
 * - Indexes on frequently queried fields
 * - Pagination to limit response size
 * - Projection to exclude unnecessary fields
 */
export const getEvents = asyncHandler(async (req, res, next) => {
  const {
    search,
    type,
    eligibility,
    startDate,
    endDate,
    organizer,
    tags,
    followed,
    page = 1,
    limit = 10
  } = req.query;
  
  // Build query
  const query = { status: 'published' }; // Only published events for public
  
  // Fuzzy search — match partial words in name, description, tags, venue
  // Also search by organizer name (requires aggregation for proper search)
  let organizerIds = [];
  if (search) {
    // First find organizers matching the search
    const matchingOrganizers = await User.find({
      role: 'organizer',
      organizerName: { $regex: search, $options: 'i' }
    }).select('_id');
    organizerIds = matchingOrganizers.map(o => o._id);
    
    // Escape special regex characters, then allow fuzzy matching (chars can have gaps)
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const fuzzyPattern = escaped.split('').join('.*');
    const searchConditions = [
      { name: { $regex: fuzzyPattern, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { venue: { $regex: search, $options: 'i' } },
      { tags: { $regex: search, $options: 'i' } }
    ];
    
    // Include events from matching organizers
    if (organizerIds.length > 0) {
      searchConditions.push({ organizer: { $in: organizerIds } });
    }
    
    query.$or = searchConditions;
  }
  
  // Type filter
  if (type) {
    query.eventType = type;
  }
  
  // Eligibility filter
  if (eligibility) {
    query.eligibility = eligibility;
  }
  
  // Date range filter
  if (startDate || endDate) {
    query.eventStartDate = {};
    if (startDate) query.eventStartDate.$gte = new Date(startDate);
    if (endDate) query.eventStartDate.$lte = new Date(endDate);
  }
  
  // Organizer filter
  if (organizer) {
    query.organizer = organizer;
  }
  
  // Tags filter
  if (tags) {
    const tagArray = tags.split(',').map(t => t.trim().toLowerCase());
    query.tags = { $in: tagArray };
  }
  
  // Price range filter
  if (req.query.minFee || req.query.maxFee) {
    query.registrationFee = {};
    if (req.query.minFee) query.registrationFee.$gte = Number(req.query.minFee);
    if (req.query.maxFee) query.registrationFee.$lte = Number(req.query.maxFee);
  }
  
  // Followed organizers filter (requires authenticated user)
  if (followed === 'true' && req.user) {
    query.organizer = { $in: req.user.followedOrganizers };
  }
  
  // Sort options
  const sortOption = req.query.sort || 'date';
  let sortObj = { eventStartDate: 1 };
  if (sortOption === 'popularity') sortObj = { registrationCount: -1, eventStartDate: 1 };
  else if (sortOption === 'fee-asc') sortObj = { registrationFee: 1, eventStartDate: 1 };
  else if (sortOption === 'fee-desc') sortObj = { registrationFee: -1, eventStartDate: 1 };
  else if (sortOption === 'newest') sortObj = { createdAt: -1 };
  
  // Calculate skip for pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Execute query
  let events = await Event.find(query)
    .populate('organizer', 'organizerName category')
    .sort(sortObj)
    .skip(skip)
    .limit(parseInt(limit));
  
  // Preference-based boosting: if authenticated participant, boost events
  // from followed organizers and matching interests to the top
  if (req.user && req.user.role === 'participant') {
    const followedIds = (req.user.followedOrganizers || []).map(id => id.toString());
    const userInterests = (req.user.interests || []).map(i => i.toLowerCase());
    
    if (followedIds.length > 0 || userInterests.length > 0) {
      events = events.map(ev => {
        const e = ev.toObject();
        let boost = 0;
        if (followedIds.includes(e.organizer?._id?.toString())) boost += 10;
        const eventTags = (e.tags || []).map(t => t.toLowerCase());
        const matchingTags = eventTags.filter(t => userInterests.some(i => t.includes(i) || i.includes(t)));
        boost += matchingTags.length * 3;
        const orgCat = e.organizer?.category?.toLowerCase();
        if (orgCat && userInterests.includes(orgCat)) boost += 5;
        e._boost = boost;
        return e;
      });
      events.sort((a, b) => (b._boost || 0) - (a._boost || 0) || new Date(a.eventStartDate) - new Date(b.eventStartDate));
      events = events.map(({ _boost, ...rest }) => rest);
    }
  }
  
  // Get total count for pagination
  const total = await Event.countDocuments(query);
  
  res.status(200).json({
    success: true,
    count: events.length,
    total,
    pages: Math.ceil(total / parseInt(limit)),
    currentPage: parseInt(page),
    events
  });
});

/**
 * @desc    Get single event
 * @route   GET /api/events/:id
 * @access  Public
 * 
 * TRACKING:
 * - Increment view count
 * - Add to recent views for trending calculation
 */
export const getEvent = asyncHandler(async (req, res, next) => {
  const event = await Event.findById(req.params.id)
    .populate('organizer', 'organizerName category description contactEmail');
  
  if (!event) {
    throw new AppError('Event not found', 404);
  }
  
  // Check access for non-published events
  if (event.status !== 'published') {
    if (!req.user || (req.user.role !== 'admin' && req.user.id !== event.organizer._id.toString())) {
      throw new AppError('Event not found', 404);
    }
  }
  
  // Track view (don't await to avoid slowing response)
  Event.updateOne(
    { _id: event._id },
    {
      $inc: { viewCount: 1 },
      $push: {
        recentViews: {
          $each: [{ timestamp: new Date() }],
          $slice: -100 // Keep only last 100 views
        }
      }
    }
  ).exec();
  
  res.status(200).json({
    success: true,
    event
  });
});

/**
 * @desc    Update event
 * @route   PUT /api/events/:id
 * @access  Private (Organizer - own events only)
 * 
 * EDITING RULES:
 * - Draft: Free edits, can publish
 * - Published: Description, deadline extension, limit increase, close
 * - Ongoing/Completed: Status change only
 */
export const updateEvent = asyncHandler(async (req, res, next) => {
  let event = await Event.findById(req.params.id);
  
  if (!event) {
    throw new AppError('Event not found', 404);
  }
  
  // Check ownership
  if (event.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('Not authorized to update this event', 403);
  }
  
  // Apply editing rules based on status
  const { status: currentStatus } = event;
  const updates = { ...req.body };
  
  if (currentStatus === 'published') {
    // Limited edits allowed
    const allowedFields = ['description', 'registrationDeadline', 'registrationLimit', 'status', 'venue'];
    
    Object.keys(updates).forEach(key => {
      if (!allowedFields.includes(key)) {
        delete updates[key];
      }
    });
    
    // Validate deadline can only extend
    if (updates.registrationDeadline && new Date(updates.registrationDeadline) < event.registrationDeadline) {
      throw new AppError('Can only extend registration deadline, not reduce', 400);
    }
    
    // Validate limit can only increase
    if (updates.registrationLimit && updates.registrationLimit < event.registrationLimit) {
      throw new AppError('Can only increase registration limit, not reduce', 400);
    }
  }
  
  if (['ongoing', 'completed'].includes(currentStatus)) {
    // Only status changes allowed
    if (Object.keys(updates).some(key => key !== 'status')) {
      throw new AppError('Cannot edit event details after it has started', 400);
    }
  }
  
  // Lock form after first registration
  if (currentStatus !== 'draft' && updates.customFields) {
    throw new AppError('Cannot modify registration form after publishing', 400);
  }

  // Business rules: if dates are being updated, validate them
  if (updates.eventStartDate || updates.eventEndDate || updates.registrationDeadline) {
    const start = updates.eventStartDate ? new Date(updates.eventStartDate) : new Date(event.eventStartDate);
    const end = updates.eventEndDate ? new Date(updates.eventEndDate) : (event.eventEndDate ? new Date(event.eventEndDate) : null);
    const regDeadline = updates.registrationDeadline ? new Date(updates.registrationDeadline) : (event.registrationDeadline ? new Date(event.registrationDeadline) : null);

    if (end) {
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new AppError('Invalid start or end date', 400);
      }
      if (end <= start) {
        throw new AppError('Event end date must be after start date', 400);
      }
    }

    if (regDeadline && start) {
      if (isNaN(regDeadline.getTime()) || isNaN(start.getTime())) {
        throw new AppError('Invalid registration deadline or start date', 400);
      }
      if (regDeadline >= start) {
        throw new AppError('Registration deadline must be before event start date', 400);
      }
    }
  }
  
  // Update event
  event = await Event.findByIdAndUpdate(
    req.params.id,
    updates,
    { new: true, runValidators: true }
  ).populate('organizer', 'organizerName category');
  
  res.status(200).json({
    success: true,
    message: 'Event updated',
    event
  });
});

/**
 * @desc    Delete event
 * @route   DELETE /api/events/:id
 * @access  Private (Organizer - own events, Admin)
 */
export const deleteEvent = asyncHandler(async (req, res, next) => {
  const event = await Event.findById(req.params.id);
  
  if (!event) {
    throw new AppError('Event not found', 404);
  }
  
  // Check ownership
  if (event.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('Not authorized to delete this event', 403);
  }
  
  // Don't allow deletion of events with registrations
  const registrationCount = await Registration.countDocuments({ event: event._id });
  if (registrationCount > 0) {
    throw new AppError('Cannot delete event with existing registrations. Mark as closed instead.', 400);
  }
  
  await event.deleteOne();
  
  res.status(200).json({
    success: true,
    message: 'Event deleted'
  });
});

/**
 * @desc    Get trending events
 * @route   GET /api/events/trending
 * @access  Public
 */
export const getTrendingEvents = asyncHandler(async (req, res, next) => {
  // Trending should always return top 5 events for the 24-hour window
  const limit = 5;
  const events = await Event.getTrending(limit);
  
  res.status(200).json({
    success: true,
    count: events.length,
    events
  });
});

/**
 * @desc    Get personalized recommendations
 * @route   GET /api/events/recommendations
 * @access  Public (personalized for logged-in participants)
 */
export const getRecommendations = asyncHandler(async (req, res, next) => {
  const limit = parseInt(req.query.limit) || 5;
  let options = {};
  if (req.user && req.user.role === 'participant') {
    options.userInterests = req.user.interests || [];
    options.followedOrganizers = req.user.followedOrganizers || [];
  }

  const events = await Event.getRecommendations(limit, options);

  res.status(200).json({
    success: true,
    count: events.length,
    events
  });
});

/**
 * @desc    Get organizer's events
 * @route   GET /api/events/my-events
 * @access  Private (Organizer)
 */
export const getMyEvents = asyncHandler(async (req, res, next) => {
  const { status, page = 1, limit = 10 } = req.query;
  
  const query = { organizer: req.user.id };
  
  if (status) {
    query.status = status;
  }
  
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const events = await Event.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));
  
  const total = await Event.countDocuments(query);
  
  res.status(200).json({
    success: true,
    count: events.length,
    total,
    pages: Math.ceil(total / parseInt(limit)),
    events
  });
});

/**
 * @desc    Get event analytics
 * @route   GET /api/events/:id/analytics
 * @access  Private (Organizer - own events)
 */
export const getEventAnalytics = asyncHandler(async (req, res, next) => {
  const event = await Event.findById(req.params.id);
  
  if (!event) {
    throw new AppError('Event not found', 404);
  }
  
  // Check ownership
  if (event.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('Not authorized to view analytics', 403);
  }
  
  // Get registration stats
  const registrations = await Registration.aggregate([
    { $match: { event: event._id } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' }
      }
    }
  ]);
  
  // Get attendance stats
  const attendance = await Registration.aggregate([
    { $match: { event: event._id } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        attended: { $sum: { $cond: ['$attended', 1, 0] } }
      }
    }
  ]);

  // Registration trend (per day for the last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const registrationTrend = await Registration.aggregate([
    { $match: { event: event._id, registeredAt: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$registeredAt' } },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  
  // Format stats
  const stats = {
    totalRegistrations: event.registrationCount,
    registrationsByStatus: {},
    revenue: 0,
    attendance: attendance[0] || { total: 0, attended: 0 },
    views: event.viewCount,
    registrationTrend: registrationTrend.map(r => ({ date: r._id, count: r.count }))
  };
  
  registrations.forEach(r => {
    stats.registrationsByStatus[r._id] = r.count;
    stats.revenue += r.totalAmount || 0;
  });
  
  res.status(200).json({
    success: true,
    event: {
      id: event._id,
      name: event.name,
      status: event.status,
      eventType: event.eventType
    },
    analytics: stats
  });
});

/**
 * @desc    Get organizer-level analytics across all their events
 * @route   GET /api/events/organizer/analytics
 * @access  Private (Organizer)
 */
export const getOrganizerAnalytics = asyncHandler(async (req, res, next) => {
  // Find all events for this organizer
  const events = await Event.find({ organizer: req.user.id });
  if (!events || events.length === 0) {
    return res.status(200).json({ success: true, analytics: { totalRegistrations: 0, registrationsByStatus: {}, revenue: 0, attendance: { total: 0, attended: 0 }, views: 0, registrationTrend: [] }, events: [] });
  }

  const eventIds = events.map(e => e._id);

  // Aggregate registrations across organizer events
  const registrationsAgg = await Registration.aggregate([
    { $match: { event: { $in: eventIds } } },
    { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$totalAmount' } } }
  ]);

  const attendanceAgg = await Registration.aggregate([
    { $match: { event: { $in: eventIds } } },
    { $group: { _id: null, total: { $sum: 1 }, attended: { $sum: { $cond: ['$attended', 1, 0] } } } }
  ]);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const registrationTrend = await Registration.aggregate([
    { $match: { event: { $in: eventIds }, registeredAt: { $gte: thirtyDaysAgo } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$registeredAt' } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);

  // Sum up views and registration counts from events
  const totalViews = events.reduce((s, e) => s + (e.viewCount || 0), 0);
  const totalRegistrations = events.reduce((s, e) => s + (e.registrationCount || 0), 0);

  const stats = {
    totalRegistrations,
    registrationsByStatus: {},
    revenue: 0,
    attendance: attendanceAgg[0] || { total: 0, attended: 0 },
    views: totalViews,
    registrationTrend: registrationTrend.map(r => ({ date: r._id, count: r.count }))
  };

  registrationsAgg.forEach(r => {
    stats.registrationsByStatus[r._id] = r.count;
    stats.revenue += r.totalAmount || 0;
  });

  res.status(200).json({ success: true, analytics: stats, events });
});

/**
 * @desc    Publish event
 * @route   PUT /api/events/:id/publish
 * @access  Private (Organizer)
 */
export const publishEvent = asyncHandler(async (req, res, next) => {
  let event = await Event.findById(req.params.id);
  
  if (!event) {
    throw new AppError('Event not found', 404);
  }
  
  if (event.organizer.toString() !== req.user.id) {
    throw new AppError('Not authorized', 403);
  }
  
  if (event.status !== 'draft') {
    throw new AppError('Only draft events can be published', 400);
  }
  
  // Validate required fields before publishing
  const requiredFields = ['name', 'description', 'eventType', 'registrationDeadline', 'eventStartDate', 'eventEndDate'];
  const missing = requiredFields.filter(f => !event[f]);
  
  if (missing.length > 0) {
    throw new AppError(`Missing required fields: ${missing.join(', ')}`, 400);
  }
  
  // Validate merchandise has variants
  if (event.eventType === 'merchandise' && (!event.variants || event.variants.length === 0)) {
    throw new AppError('Merchandise events must have at least one variant', 400);
  }
  
  event.status = 'published';
  await event.save();
  
  // Send Discord webhook notification if configured
  const organizer = await User.findById(req.user.id);
  if (organizer?.discordWebhook) {
    try {
      const payload = {
        content: null,
        embeds: [{
          title: `🎉 New Event: ${event.name}`,
          description: event.description?.substring(0, 200) || '',
          color: event.eventType === 'merchandise' ? 0x00b894 : 0x6c5ce7,
          fields: [
            { name: 'Type', value: event.eventType, inline: true },
            { name: 'Eligibility', value: event.eligibility, inline: true },
            { name: 'Start Date', value: new Date(event.eventStartDate).toLocaleDateString(), inline: true },
            { name: 'Deadline', value: new Date(event.registrationDeadline).toLocaleDateString(), inline: true }
          ],
          footer: { text: `By ${organizer.organizerName} | Felicity` }
        }]
      };
      await fetch(organizer.discordWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (webhookError) {
      console.error('Discord webhook failed:', webhookError.message);
      // Don't fail event publish if webhook fails
    }
  }
  
  res.status(200).json({
    success: true,
    message: 'Event published successfully',
    event
  });
});
