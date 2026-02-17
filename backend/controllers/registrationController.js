/**
 * Registration Controller
 * 
 * HANDLES:
 * - Event registration (normal events)
 * - Merchandise purchase
 * - Ticket generation with QR
 * - Participant history
 * - Attendance marking
 * 
 * WORKFLOWS:
 * Normal Event: Register → Confirm → Generate Ticket → Email
 * Merchandise: Select Variant → Check Stock → Purchase → Decrement Stock → Ticket → Email
 */

import Registration from '../models/Registration.js';
import Event from '../models/Event.js';
import User from '../models/User.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { generateTicketQR } from '../utils/qrcode.js';
import sendEmail, { sendRegistrationEmail, sendMerchandiseEmail } from '../utils/email.js';

/**
 * @desc    Register for a normal event
 * @route   POST /api/registrations/event/:eventId
 * @access  Private (Participant)
 * 
 * VALIDATION:
 * - Event exists and is published
 * - Registration is open (before deadline)
 * - Limit not reached
 * - Eligibility check
 * - Not already registered
 */
export const registerForEvent = asyncHandler(async (req, res, next) => {
  const { eventId } = req.params;
  const { formResponses } = req.body;
  
  // Get event
  const event = await Event.findById(eventId);
  
  if (!event) {
    throw new AppError('Event not found', 404);
  }
  
  // Check event type
  if (event.eventType !== 'normal') {
    throw new AppError('Use the merchandise endpoint for merchandise events', 400);
  }
  
  // Check if event is published
  if (event.status !== 'published') {
    throw new AppError('Event is not open for registration', 400);
  }
  
  // Check registration deadline
  if (new Date() > event.registrationDeadline) {
    throw new AppError('Registration deadline has passed', 400);
  }
  
  // Check registration limit
  if (event.registrationLimit && event.registrationCount >= event.registrationLimit) {
    throw new AppError('Event is fully booked', 400);
  }
  
  // Check eligibility
  const participant = await User.findById(req.user.id);
  
  if (event.eligibility === 'iiit-only' && participant.participantType !== 'iiit') {
    throw new AppError('This event is only for IIIT students', 403);
  }
  
  if (event.eligibility === 'non-iiit-only' && participant.participantType === 'iiit') {
    throw new AppError('This event is only for non-IIIT participants', 403);
  }
  
  // Check if already registered (allow re-registration if previous was cancelled or rejected)
  const existingReg = await Registration.findOne({
    event: eventId,
    participant: req.user.id,
    status: { $nin: ['cancelled', 'rejected'] }
  });
  
  if (existingReg) {
    throw new AppError('You are already registered for this event', 400);
  }

  // Remove old cancelled/rejected registrations so a fresh one can be created
  await Registration.deleteMany({
    event: eventId,
    participant: req.user.id,
    status: { $in: ['cancelled', 'rejected'] }
  });
  
  // Validate form responses against custom fields
  if (event.customFields && event.customFields.length > 0) {
    const requiredFields = event.customFields.filter(f => f.required);
    
    for (const field of requiredFields) {
      const response = formResponses?.find(r => r.fieldId === field.fieldId);
      if (!response || !response.value) {
        throw new AppError(`${field.label} is required`, 400);
      }
    }
  }
  
  // Enrich formResponses with labels from event customFields so schema validation passes
  const enrichedFormResponses = (formResponses || []).map(r => {
    const field = event.customFields?.find(f => f.fieldId === r.fieldId);
    return { fieldId: r.fieldId, label: field?.label || r.fieldId, value: r.value };
  });
  
  // Create registration
  // Create registration. If event requires manual payment approval and has a fee,
  // create a pending registration and ask user to upload proof. Otherwise confirm and generate QR.
  let registration;
  // If event has a fee (>0) treat it as requiring payment verification (prompt proof upload)
  if (event.registrationFee && event.registrationFee > 0) {
    registration = await Registration.create({
      event: eventId,
      participant: req.user.id,
      registrationType: 'normal',
      formResponses: enrichedFormResponses,
      status: 'pending',
      paymentStatus: 'pending',
      totalAmount: event.registrationFee
    });

    // Notify participant to upload payment proof
    try {
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:30px;text-align:center;border-radius:10px 10px 0 0">
            <h1>💳 Payment Required</h1><p>Felicity Registration</p>
          </div>
          <div style="background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px">
            <p>Hi <strong>${participant.firstName}</strong>,</p>
            <p>Your registration for <strong>${event.name}</strong> is pending because this event requires manual payment verification.</p>
            <div style="background:#fff;border:2px dashed #667eea;padding:20px;margin:20px 0;border-radius:10px">
              <p><strong>Registration ID:</strong> ${registration.ticketId}</p>
              <p><strong>Amount:</strong> ₹${registration.totalAmount}</p>
            </div>
            <div style="background:#fff3cd;border:1px solid #ffc107;padding:15px;border-radius:5px;margin-top:15px">
              <strong>⚠️ Action Required:</strong> Please upload your payment proof (screenshot/receipt) on the Ticket page to complete your registration. Your registration will remain pending until the organizer approves the payment.
            </div>
          </div>
        </div>
      `;
      await (await import('../services/emailService.js')).default.enqueue({ to: participant.email, subject: `Payment Required — ${event.name}`, html });
      registration.confirmationEmailSent = true;
      await registration.save();
    } catch (e) {
      console.error('Failed to enqueue payment-required email:', e);
    }
  } else {
    registration = await Registration.create({
      event: eventId,
      participant: req.user.id,
      registrationType: 'normal',
      formResponses: enrichedFormResponses,
      status: 'confirmed',
      totalAmount: event.registrationFee
    });

    // Generate QR code
    const qrCodeData = await generateTicketQR(registration, event, participant);
    registration.qrCodeData = qrCodeData;
    await registration.save();
    // Send confirmation email with QR
    try {
      await sendRegistrationEmail(participant, event, registration);
      registration.confirmationEmailSent = true;
      await registration.save();
    } catch (e) {
      console.error('Failed to send registration email:', e);
    }
  }
  
  // Increment registration count
  await Event.findByIdAndUpdate(eventId, {
    $inc: { registrationCount: 1 },
    formLocked: true // Lock form after first registration
  });

  // Push recent registration timestamp for trending (non-blocking)
  Event.updateOne({ _id: eventId }, { $push: { recentRegistrations: { $each: [{ timestamp: new Date() }], $slice: -200 } } }).exec();
  
  // Send confirmation email ONLY for free events (paid events already got a
  // "Payment Required" email above; the real confirmation is sent on approval)
  if (!event.registrationFee || event.registrationFee <= 0) {
    try {
      const html = `<p>Hi <strong>${participant.firstName}</strong>,</p><p>Your registration for <strong>${event.name}</strong> is confirmed. Ticket ID: <strong>${registration.ticketId}</strong></p>`;
      await (await import('../services/emailService.js')).default.enqueue({ to: participant.email, subject: `🎫 Registration Confirmed - ${event.name}`, html });
      registration.confirmationEmailSent = true;
      await registration.save();
    } catch (emailError) {
      console.error('Failed to enqueue confirmation email:', emailError);
    }
  }
  
  // Populate for response
  await registration.populate('event', 'name eventType eventStartDate eventEndDate venue');
  
  res.status(201).json({
    success: true,
    message: 'Registration successful',
    registration
  });
});

/**
 * @desc    Purchase merchandise
 * @route   POST /api/registrations/merchandise/:eventId
 * @access  Private (Participant)
 * 
 * WORKFLOW:
 * 1. Validate event and variant
 * 2. Check stock availability
 * 3. Check purchase limit
 * 4. Create registration
 * 5. Decrement stock
 * 6. Generate ticket with QR
 * 7. Send confirmation email
 */
export const purchaseMerchandise = asyncHandler(async (req, res, next) => {
  const { eventId } = req.params;
  const { variantId, quantity = 1 } = req.body;
  
  // Get event
  const event = await Event.findById(eventId);
  
  if (!event) {
    throw new AppError('Event not found', 404);
  }
  
  if (event.eventType !== 'merchandise') {
    throw new AppError('This is not a merchandise event', 400);
  }
  
  if (event.status !== 'published') {
    throw new AppError('Merchandise is not available for purchase', 400);
  }
  
  // Check deadline
  if (new Date() > event.registrationDeadline) {
    throw new AppError('Purchase deadline has passed', 400);
  }
  
  // Find variant
  const variant = event.variants.id(variantId);
  
  if (!variant) {
    throw new AppError('Variant not found', 404);
  }
  
  // Check stock
  if (variant.stock < quantity) {
    throw new AppError(`Only ${variant.stock} items available`, 400);
  }
  
  // Check purchase limit
  const existingPurchases = await Registration.aggregate([
    {
      $match: {
        event: event._id,
        participant: req.user._id,
        status: { $ne: 'cancelled' }
      }
    },
    {
      $group: {
        _id: null,
        totalQuantity: { $sum: '$quantity' }
      }
    }
  ]);
  
  const currentQuantity = existingPurchases[0]?.totalQuantity || 0;
  
  if (currentQuantity + quantity > event.purchaseLimit) {
    throw new AppError(`Purchase limit is ${event.purchaseLimit} items per person`, 400);
  }
  
  // Get participant
  const participant = await User.findById(req.user.id);
  
  // Create registration
  // If event requires manual payment approval, create pending registration and reserve stock
  let registration;
  if (event.requiresPaymentApproval) {
    registration = await Registration.create({
      event: eventId,
      participant: req.user.id,
      registrationType: 'merchandise',
      selectedVariant: variantId,
      variantDetails: {
        name: variant.name,
        size: variant.size,
        color: variant.color,
        price: variant.price
      },
      quantity,
      totalAmount: variant.price * quantity,
      status: 'pending',
      paymentStatus: 'pending'
    });

    // Reserve stock by decrementing available stock but marking registration pending.
    // This prevents oversell while awaiting proof. We'll decrement sold only on approval.
    variant.stock -= quantity;
    await event.save();

    // Increment registration count (reserved)
    await Event.findByIdAndUpdate(eventId, { $inc: { registrationCount: 1 } });

    // Send "order placed – upload proof" email to participant
    try {
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:30px;text-align:center;border-radius:10px 10px 0 0">
            <h1>🛍️ Order Placed!</h1><p>Felicity Merchandise</p>
          </div>
          <div style="background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px">
            <p>Hi <strong>${participant.firstName}</strong>,</p>
            <p>Your order for <strong>${event.name}</strong> has been placed successfully.</p>
            <div style="background:#fff;border:2px dashed #667eea;padding:20px;margin:20px 0;border-radius:10px">
              <p><strong>Order ID:</strong> ${registration.ticketId}</p>
              <p><strong>Item:</strong> ${variant.name} ${variant.size ? '(' + variant.size + ')' : ''} x${quantity}</p>
              <p><strong>Total:</strong> ₹${registration.totalAmount}</p>
            </div>
            <div style="background:#fff3cd;border:1px solid #ffc107;padding:15px;border-radius:5px;margin-top:15px">
              <strong>⚠️ Action Required:</strong> Please upload your payment proof (screenshot/receipt) on the Ticket page to complete your order. Your order will remain pending until the organizer approves the payment.
            </div>
          </div>
        </div>
      `;
      await sendEmail({
        to: participant.email,
        subject: `🛍️ Order Placed — Upload Payment Proof | ${event.name}`,
        html
      });
    } catch (emailError) {
      console.error('Failed to send order-placed email:', emailError);
    }
  } else {
    // Immediate confirmed purchase
    registration = await Registration.create({
      event: eventId,
      participant: req.user.id,
      registrationType: 'merchandise',
      selectedVariant: variantId,
      variantDetails: {
        name: variant.name,
        size: variant.size,
        color: variant.color,
        price: variant.price
      },
      quantity,
      totalAmount: variant.price * quantity,
      status: 'confirmed',
      paymentStatus: 'not_required'
    });

    // Generate QR code
    const qrCodeData = await generateTicketQR(registration, event, participant);
    registration.qrCodeData = qrCodeData;
    await registration.save();

    // Decrement stock and increment sold
    variant.stock -= quantity;
    variant.sold += quantity;
    await event.save();

    // Increment registration count
    await Event.findByIdAndUpdate(eventId, { $inc: { registrationCount: 1 } });

  // Push recent registration timestamp for trending (non-blocking)
  Event.updateOne({ _id: eventId }, { $push: { recentRegistrations: { $each: [{ timestamp: new Date() }], $slice: -200 } } }).exec();

    // Send confirmation email
    try {
      const html = `<p>Hi <strong>${participant.firstName}</strong>,</p><p>Your order for <strong>${event.name}</strong> has been confirmed. Order ID: <strong>${registration.ticketId}</strong></p>`;
      await (await import('../services/emailService.js')).default.enqueue({ to: participant.email, subject: `🛍️ Order Confirmed - ${event.name}`, html });
      registration.confirmationEmailSent = true;
      await registration.save();
    } catch (emailError) {
      console.error('Failed to enqueue merchandise confirmation email:', emailError);
    }
  }
  
  res.status(201).json({
    success: true,
    message: 'Purchase successful',
    registration
  });
});

/**
 * @desc    Get participant's registrations (My Events)
 * @route   GET /api/registrations/my-registrations
 * @access  Private (Participant)
 */
export const getMyRegistrations = asyncHandler(async (req, res, next) => {
  const { type, status, upcoming } = req.query;
  
  const query = { participant: req.user.id };
  
  if (type) {
    query.registrationType = type;
  }
  
  if (status) {
    query.status = status;
  }
  
  let registrations = await Registration.find(query)
    .populate({
      path: 'event',
      select: 'name eventType organizer eventStartDate eventEndDate status venue',
      populate: {
        path: 'organizer',
        select: 'organizerName'
      }
    })
    .populate('team', 'teamName teamLeader inviteCode isComplete teamSize members')
    .sort({ registeredAt: -1 });
  
  // Filter upcoming if requested
  if (upcoming === 'true') {
    registrations = registrations.filter(r => 
      r.event && new Date(r.event.eventStartDate) > new Date()
    );
  }

  // Debugging: log query and the registration types being returned to help trace UI mismatches
  try {
    console.log('[getMyRegistrations] user=', req.user?.id, 'query=', req.query, 'returnedCount=', registrations.length, 'types=', registrations.map(r => r.registrationType));
  } catch (e) {}
  
  // Defensive server-side filtering: ensure returned registrations match requested type
  if (type) {
    const tLower = String(type).toLowerCase();
    registrations = registrations.filter(r => {
      const regType = String(r.registrationType || '').toLowerCase();
      const eventType = String(r.event?.eventType || '').toLowerCase();
      return regType === tLower || eventType === tLower;
    });
  }
  
  res.status(200).json({
    success: true,
    count: registrations.length,
    registrations
  });
});

/**
 * @desc    Get single registration (ticket)
 * @route   GET /api/registrations/:id
 * @access  Private
 */
export const getRegistration = asyncHandler(async (req, res, next) => {
  const registration = await Registration.findById(req.params.id)
    .populate({
      path: 'event',
      select: 'name eventType organizer eventStartDate eventEndDate venue requiresPaymentApproval',
      populate: {
        path: 'organizer',
        select: 'organizerName'
      }
    })
    .populate('participant', 'firstName lastName email')
    .populate('team', 'teamName teamLeader inviteCode isComplete teamSize members');
  
  if (!registration) {
    throw new AppError('Registration not found', 404);
  }
  
  // Check access
  if (
    registration.participant._id.toString() !== req.user.id &&
    req.user.role !== 'admin'
  ) {
    // Check if organizer owns the event
    const event = await Event.findById(registration.event._id);
    if (!event || event.organizer.toString() !== req.user.id) {
      throw new AppError('Not authorized to view this registration', 403);
    }
  }
  
  res.status(200).json({
    success: true,
    registration
  });
});

/**
 * @desc    Cancel registration
 * @route   PUT /api/registrations/:id/cancel
 * @access  Private (Participant - own registrations)
 */
export const cancelRegistration = asyncHandler(async (req, res, next) => {
  const registration = await Registration.findById(req.params.id);
  
  if (!registration) {
    throw new AppError('Registration not found', 404);
  }
  
  if (registration.participant.toString() !== req.user.id) {
    throw new AppError('Not authorized', 403);
  }
  
  if (registration.status === 'cancelled') {
    throw new AppError('Registration already cancelled', 400);
  }
  
  if (registration.attended) {
    throw new AppError('Cannot cancel after attending', 400);
  }
  
  // Get event to check if cancellation is allowed
  const event = await Event.findById(registration.event);
  
  if (new Date() > event.eventStartDate) {
    throw new AppError('Cannot cancel after event has started', 400);
  }
  
  // Update registration
  registration.status = 'cancelled';
  await registration.save();
  
  // Decrement counts
  await Event.findByIdAndUpdate(registration.event, {
    $inc: { registrationCount: -1 }
  });
  
  // Restore stock for merchandise
  if (registration.registrationType === 'merchandise') {
    const variant = event.variants.id(registration.selectedVariant);
    if (variant) {
      variant.stock += registration.quantity;
      variant.sold -= registration.quantity;
      await event.save();
    }
  }
  
  res.status(200).json({
    success: true,
    message: 'Registration cancelled',
    registration
  });
});

/**
 * @desc    Get event registrations (for organizers)
 * @route   GET /api/registrations/event/:eventId
 * @access  Private (Organizer - own events)
 */
export const getEventRegistrations = asyncHandler(async (req, res, next) => {
  const event = await Event.findById(req.params.eventId);
  
  if (!event) {
    throw new AppError('Event not found', 404);
  }
  
  // Check ownership
  if (event.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('Not authorized', 403);
  }
  
  const { status, attended, search, page = 1, limit = 20 } = req.query;
  
  const query = { event: req.params.eventId };
  
  if (status) {
    query.status = status;
  }
  
  if (attended !== undefined) {
    query.attended = attended === 'true';
  }
  
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  let registrations = await Registration.find(query)
    .populate('participant', 'firstName lastName email contactNumber collegeName')
    .sort({ registeredAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));
  
  // Search filter (applied after population)
  if (search) {
    const searchLower = search.toLowerCase();
    registrations = registrations.filter(r => 
      r.participant.firstName?.toLowerCase().includes(searchLower) ||
      r.participant.lastName?.toLowerCase().includes(searchLower) ||
      r.participant.email?.toLowerCase().includes(searchLower) ||
      r.ticketId?.toLowerCase().includes(searchLower)
    );
  }
  
  const total = await Registration.countDocuments(query);
  
  res.status(200).json({
    success: true,
    count: registrations.length,
    total,
    pages: Math.ceil(total / parseInt(limit)),
    registrations
  });
});

/**
 * @desc    Export registrations as CSV
 * @route   GET /api/registrations/event/:eventId/export
 * @access  Private (Organizer)
 */
export const exportRegistrations = asyncHandler(async (req, res, next) => {
  const event = await Event.findById(req.params.eventId);
  
  if (!event) {
    throw new AppError('Event not found', 404);
  }
  
  if (event.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('Not authorized', 403);
  }
  
  const registrations = await Registration.find({ event: req.params.eventId })
    .populate('participant', 'firstName lastName email contactNumber collegeName')
    .sort({ registeredAt: -1 });
  
  // Build CSV
  const headers = ['Ticket ID', 'First Name', 'Last Name', 'Email', 'Contact', 'College', 'Status', 'Attended', 'Registered At'];
  
  if (event.eventType === 'merchandise') {
    headers.push('Variant', 'Quantity', 'Amount');
  }
  
  let csv = headers.join(',') + '\n';
  
  for (const reg of registrations) {
    const row = [
      reg.ticketId,
      reg.participant?.firstName || '',
      reg.participant?.lastName || '',
      reg.participant?.email || '',
      reg.participant?.contactNumber || '',
      reg.participant?.collegeName || '',
      reg.status,
      reg.attended ? 'Yes' : 'No',
      new Date(reg.registeredAt).toISOString()
    ];
    
    if (event.eventType === 'merchandise') {
      row.push(
        reg.variantDetails?.name || '',
        reg.quantity || 0,
        reg.totalAmount || 0
      );
    }
    
    csv += row.map(v => `"${v}"`).join(',') + '\n';
  }
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${event.name}-registrations.csv"`);
  res.send(csv);
});

/**
 * @desc    Mark attendance
 * @route   PUT /api/registrations/:id/attend
 * @access  Private (Organizer)
 */
export const markAttendance = asyncHandler(async (req, res, next) => {
  const registration = await Registration.findById(req.params.id)
    .populate('event');
  
  if (!registration) {
    throw new AppError('Registration not found', 404);
  }
  
  // Check organizer owns the event
  if (registration.event.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('Not authorized', 403);
  }

  // Attendance can only be marked once the event has started
  if (new Date() < new Date(registration.event.eventStartDate)) {
    throw new AppError('Attendance can only be marked after the event has started', 400);
  }
  
  if (registration.status !== 'confirmed') {
    throw new AppError('Only confirmed registrations can be marked as attended', 400);
  }
  
  if (registration.attended) {
    throw new AppError('Already marked as attended', 400);
  }
  
  registration.attended = true;
  registration.attendedAt = new Date();
  registration.status = 'attended';
  await registration.save();
  
  res.status(200).json({
    success: true,
    message: 'Attendance marked',
    registration
  });
});

/**
 * @desc    Upload payment proof for merchandise (Tier A Feature)
 * @route   PUT /api/registrations/:id/payment-proof
 * @access  Private (Participant)
 */
export const uploadPaymentProof = asyncHandler(async (req, res, next) => {
  const registration = await Registration.findById(req.params.id);

  if (!registration) {
    throw new AppError('Registration not found', 404);
  }

  if (registration.participant.toString() !== req.user.id) {
    throw new AppError('Not authorized', 403);
  }

  if (!req.file) {
    throw new AppError('Please upload a payment proof image', 400);
  }

  // If S3 upload middleware set `req.file.s3Url`, use that full URL. Otherwise
  // fallback to local disk path which is served at /uploads
  if (req.file.s3Url) {
    registration.paymentProof = req.file.s3Url;
  } else {
    registration.paymentProof = `/uploads/${req.file.filename}`;
  }
  registration.paymentStatus = 'pending';
  registration.status = 'pending';
  await registration.save();

  // Notify organizer that a payment proof has been uploaded
  try {
  // Populate event and organizer (including contactEmail)
  await registration.populate({ path: 'event', populate: { path: 'organizer', select: 'organizerName email contactEmail' } });
  const event = registration.event;
  const organizer = event?.organizer;
  const notifyTo = organizer && (organizer.contactEmail || organizer.email);
  if (organizer && notifyTo) {
      const apiUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
      const proofUrl = `${apiUrl}${registration.paymentProof}`;
      const html = `
        <p>Hi ${organizer.organizerName || 'Organizer'},</p>
        <p>A payment proof has been uploaded for order <strong>${registration.ticketId}</strong> on event <strong>${event.name}</strong>.</p>
        <p>View the proof: <a href="${proofUrl}" target="_blank">Open proof</a></p>
        <p>Approve or reject the payment in the event registrations → Payments tab.</p>
      `;
      try {
        await (await import('../services/emailService.js')).default.enqueue({ to: notifyTo, subject: `Payment proof uploaded for ${event.name}`, html });
      } catch (e) {
        console.error('Failed to enqueue organizer notification for payment proof:', e);
      }
    }
  } catch (e) {
    console.error('Failed to notify organizer about payment proof upload:', e);
    // don't fail the upload if email fails
  }

  res.status(200).json({
    success: true,
    message: 'Payment proof uploaded. Awaiting approval.',
    registration
  });
});

/**
 * @desc    Approve/Reject payment for merchandise (Tier A Feature)
 * @route   PUT /api/registrations/:id/payment-action
 * @access  Private (Organizer)
 */
export const paymentAction = asyncHandler(async (req, res, next) => {
  const { action } = req.body; // 'approve' or 'reject'

  if (!['approve', 'reject'].includes(action)) {
    throw new AppError('Action must be approve or reject', 400);
  }

  const registration = await Registration.findById(req.params.id)
    .populate('event')
    .populate('participant', 'firstName lastName email');

  if (!registration) {
    throw new AppError('Registration not found', 404);
  }

  // Check organizer owns the event
  if (registration.event.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('Not authorized', 403);
  }

  if (registration.paymentStatus !== 'pending') {
    throw new AppError('Payment is not in pending state', 400);
  }

    if (action === 'approve') {
    registration.paymentStatus = 'approved';
    registration.status = 'confirmed';

    // Generate QR code now that payment is approved
    try {
      const qrCodeData = await generateTicketQR(registration, registration.event, registration.participant);
      registration.qrCodeData = qrCodeData;
    } catch (qrErr) {
      console.error('Failed to generate QR code on approval:', qrErr);
      // Continue with approval even if QR fails — participant can still use ticket ID
    }

    // Send confirmation email via queue (non-blocking) so approval response is not delayed
    try {
      const participant = registration.participant;
      const event = registration.event;
      let html;
      if (registration.registrationType === 'merchandise') {
        html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:linear-gradient(135deg,#11998e,#38ef7d);color:#fff;padding:30px;text-align:center;border-radius:10px 10px 0 0">
              <h1>🛍️ Order Confirmed!</h1><p>Felicity Merchandise</p>
            </div>
            <div style="background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px">
              <p>Hi <strong>${participant.firstName}</strong>,</p>
              <p>Your payment has been approved and your merchandise order <strong>${registration.ticketId}</strong> for <strong>${event.name}</strong> is confirmed!</p>
              ${registration.qrCodeData ? `<div style="text-align:center;margin:20px 0"><img src="${registration.qrCodeData}" alt="QR Code" style="max-width:200px" /><p style="font-size:12px;color:#666">Show this QR code for pickup</p></div>` : ''}
            </div>
          </div>
        `;
      } else {
        html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:30px;text-align:center;border-radius:10px 10px 0 0">
              <h1>🎉 Registration Confirmed!</h1><p>Felicity 2026</p>
            </div>
            <div style="background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px">
              <p>Hi <strong>${participant.firstName}</strong>,</p>
              <p>Your payment has been approved! Your registration for <strong>${event.name}</strong> is now confirmed.</p>
              <div style="background:#fff;border:2px dashed #667eea;padding:20px;margin:20px 0;border-radius:10px;text-align:center">
                <p style="font-size:24px;font-weight:bold;color:#667eea">🎫 ${registration.ticketId}</p>
              </div>
              ${registration.qrCodeData ? `<div style="text-align:center;margin:20px 0"><img src="${registration.qrCodeData}" alt="QR Code" style="max-width:200px" /><p style="font-size:12px;color:#666">Show this QR code at the venue</p></div>` : ''}
            </div>
          </div>
        `;
      }
      await (await import('../services/emailService.js')).default.enqueue({
        to: participant.email,
        subject: `✅ Payment Approved — ${event.name}`,
        html
      });
      registration.confirmationEmailSent = true;
    } catch (e) {
      console.error('Failed to enqueue confirmation email:', e);
    }
    // Mark sold count if variants exist
    try {
      const eventDoc = await Event.findById(registration.event._id);
      const variant = eventDoc.variants.id(registration.selectedVariant);
      if (variant) {
        variant.sold += registration.quantity;
        await eventDoc.save();
      }
    } catch (e) {
      console.error('Failed to update sold count on approval:', e);
    }
  } else {
    registration.paymentStatus = 'rejected';
    registration.status = 'rejected';

    // Restore stock
    const event = await Event.findById(registration.event._id);
    const variant = event.variants.id(registration.selectedVariant);
    if (variant) {
      variant.stock += registration.quantity;
      variant.sold -= registration.quantity;
      await event.save();
    }
    await Event.findByIdAndUpdate(registration.event._id, {
      $inc: { registrationCount: -1 }
    });

    // Send rejection email to participant
    try {
        const html = `<p>Hi <strong>${registration.participant.firstName}</strong>,</p><p>Unfortunately, your payment for order <strong>${registration.ticketId}</strong> on <strong>${registration.event.name}</strong> has been rejected by the organizer. You may place a new order and upload a valid payment proof.</p>`;
        await (await import('../services/emailService.js')).default.enqueue({ to: registration.participant.email, subject: `Payment Rejected — ${registration.event.name}`, html });
    } catch (e) {
      console.error('Failed to send rejection email:', e);
    }
  }

  await registration.save();

  res.status(200).json({
    success: true,
    message: `Payment ${action}d successfully`,
    registration
  });
});

/**
 * @desc    Scan QR code and validate ticket (Tier A Feature)
 * @route   POST /api/registrations/scan-qr
 * @access  Private (Organizer)
 */
export const scanQRCode = asyncHandler(async (req, res, next) => {
  const { qrData } = req.body;

  if (!qrData) {
    throw new AppError('QR data is required', 400);
  }

  let parsed;
  try {
    parsed = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
  } catch (e) {
    throw new AppError('Invalid QR code data', 400);
  }

  if (!parsed.ticketId) {
    throw new AppError('Invalid QR code - no ticket ID found', 400);
  }

  const registration = await Registration.findOne({ ticketId: parsed.ticketId })
    .populate('event', 'name organizer eventType status')
    .populate('participant', 'firstName lastName email');

  if (!registration) {
    throw new AppError('Ticket not found', 404);
  }

  // Check organizer owns the event
  if (registration.event.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('Not authorized to scan for this event', 403);
  }

  // Check if already attended (duplicate scan)
  if (registration.attended) {
    return res.status(200).json({
      success: false,
      duplicate: true,
      message: `Already scanned at ${new Date(registration.attendedAt).toLocaleString()}`,
      registration
    });
  }

  if (registration.status === 'cancelled' || registration.status === 'rejected') {
    return res.status(200).json({
      success: false,
      message: `Ticket is ${registration.status}`,
      registration
    });
  }

  // Mark attendance
  registration.attended = true;
  registration.attendedAt = new Date();
  registration.status = 'attended';
  await registration.save();

  res.status(200).json({
    success: true,
    message: 'Attendance marked successfully',
    registration
  });
});

/**
 * @desc    Get attendance dashboard for an event (Tier A Feature)
 * @route   GET /api/registrations/event/:eventId/attendance
 * @access  Private (Organizer)
 */
export const getAttendanceDashboard = asyncHandler(async (req, res, next) => {
  const event = await Event.findById(req.params.eventId);
  if (!event) throw new AppError('Event not found', 404);

  if (event.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('Not authorized', 403);
  }

  const [total, attended, notAttended] = await Promise.all([
    Registration.countDocuments({ event: req.params.eventId, status: { $in: ['confirmed', 'attended'] } }),
    Registration.countDocuments({ event: req.params.eventId, attended: true }),
    Registration.find({ event: req.params.eventId, status: 'confirmed', attended: false })
      .populate('participant', 'firstName lastName email')
      .sort({ registeredAt: -1 })
  ]);

  const attendedList = await Registration.find({ event: req.params.eventId, attended: true })
    .populate('participant', 'firstName lastName email')
    .sort({ attendedAt: -1 });

  res.status(200).json({
    success: true,
    stats: { total, attended, pending: total - attended },
    attendedList,
    notAttendedList: notAttended
  });
});

/**
 * @desc    Get all registrations for organizer across their events
 * @route   GET /api/registrations/organizer/all
 * @access  Private (Organizer)
 */
export const getOrganizerRegistrations = asyncHandler(async (req, res, next) => {
  // Find event ids for this organizer
  const events = await Event.find({ organizer: req.user.id }).select('_id');
  const eventIds = events.map(e => e._id);

  const regs = await Registration.find({ event: { $in: eventIds } })
    .populate('event')
    .populate('participant', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .limit(1000);

  res.status(200).json({ success: true, count: regs.length, registrations: regs });
});

/**
 * @desc    Manual attendance override (Tier A Feature)
 * @route   PUT /api/registrations/:id/manual-attend
 * @access  Private (Organizer)
 */
export const manualAttendanceOverride = asyncHandler(async (req, res, next) => {
  const { reason } = req.body;

  const registration = await Registration.findById(req.params.id)
    .populate('event');

  if (!registration) throw new AppError('Registration not found', 404);

  if (registration.event.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('Not authorized', 403);
  }

  registration.attended = true;
  registration.attendedAt = new Date();
  registration.status = 'attended';
  registration.attendanceOverride = {
    overridden: true,
    reason: reason || 'Manual override by organizer',
    overriddenBy: req.user.id,
    overriddenAt: new Date()
  };
  await registration.save();

  res.status(200).json({
    success: true,
    message: 'Manual attendance override applied',
    registration
  });
});

/**
 * @desc    Export event to calendar (.ics file)
 * @route   GET /api/registrations/:id/calendar
 * @access  Private (Participant)
 */
export const exportToCalendar = asyncHandler(async (req, res, next) => {
  const registration = await Registration.findById(req.params.id)
    .populate('event')
    .populate({
      path: 'event',
      populate: { path: 'organizer', select: 'organizerName' }
    });
  
  if (!registration) throw new AppError('Registration not found', 404);
  
  if (registration.participant.toString() !== req.user.id) {
    throw new AppError('Not authorized', 403);
  }
  
  const { generateICS } = await import('../utils/calendar.js');
  const icsContent = generateICS(registration.event, registration);
  
  res.setHeader('Content-Type', 'text/calendar');
  res.setHeader('Content-Disposition', `attachment; filename="${registration.event.name.replace(/[^a-z0-9]/gi, '_')}.ics"`);
  res.send(icsContent);
});

/**
 * @desc    Export multiple events to calendar (batch)
 * @route   POST /api/registrations/calendar/batch
 * @access  Private (Participant)
 */
export const exportBatchToCalendar = asyncHandler(async (req, res, next) => {
  const { registrationIds } = req.body;
  
  if (!registrationIds || !Array.isArray(registrationIds) || registrationIds.length === 0) {
    throw new AppError('Please provide registration IDs', 400);
  }
  
  const registrations = await Registration.find({
    _id: { $in: registrationIds },
    participant: req.user.id
  }).populate({
    path: 'event',
    populate: { path: 'organizer', select: 'organizerName' }
  });
  
  if (registrations.length === 0) {
    throw new AppError('No valid registrations found', 404);
  }
  
  const events = registrations.map(r => r.event);
  const { generateBatchICS } = await import('../utils/calendar.js');
  const icsContent = generateBatchICS(events);
  
  res.setHeader('Content-Type', 'text/calendar');
  res.setHeader('Content-Disposition', 'attachment; filename="felicity_events.ics"');
  res.send(icsContent);
});

/**
 * @desc    Get calendar integration links (Google/Outlook)
 * @route   GET /api/registrations/:id/calendar-links
 * @access  Private (Participant)
 */
export const getCalendarLinks = asyncHandler(async (req, res, next) => {
  const registration = await Registration.findById(req.params.id)
    .populate({
      path: 'event',
      populate: { path: 'organizer', select: 'organizerName' }
    });
  
  if (!registration) throw new AppError('Registration not found', 404);
  
  if (registration.participant.toString() !== req.user.id) {
    throw new AppError('Not authorized', 403);
  }
  
  const { generateGoogleCalendarURL, generateOutlookCalendarURL } = await import('../utils/calendar.js');
  
  res.status(200).json({
    success: true,
    links: {
      google: generateGoogleCalendarURL(registration.event),
      outlook: generateOutlookCalendarURL(registration.event),
      ics: `/api/registrations/${registration._id}/calendar`
    }
  });
});
