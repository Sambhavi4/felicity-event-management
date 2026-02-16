/**
 * Registration Model
 * 
 * DESIGN DECISIONS:
 * 
 * 1. SEPARATE COLLECTION
 *    - Registrations in their own collection (not embedded in Event)
 *    - Enables efficient queries for participant history
 *    - Allows for complex registration workflows (pending, approved, etc.)
 * 
 * 2. TICKET SYSTEM
 *    - Unique ticketId for each registration
 *    - QR code data stored for offline validation
 *    - Attendance tracking with timestamp
 * 
 * 3. MERCHANDISE HANDLING
 *    - selectedVariant for merchandise purchases
 *    - quantity for multiple items
 *    - Payment proof for approval workflow (Tier A feature)
 */

import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

// Schema for storing custom form responses
const formResponseSchema = new mongoose.Schema({
  fieldId: {
    type: String,
    required: true
  },
  label: {
    type: String,
    required: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  }
}, { _id: false });

const registrationSchema = new mongoose.Schema({
  // References
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  
  participant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Unique ticket identifier
  ticketId: {
    type: String,
    unique: true,
    default: () => `FEL-${uuidv4().substring(0, 8).toUpperCase()}`
  },
  
  // Registration type (mirrors event type for easier querying)
  registrationType: {
    type: String,
    enum: ['normal', 'merchandise'],
    required: true
  },
  
  // Status workflow
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'rejected', 'attended'],
    default: 'confirmed'
  },
  
  // ============ NORMAL EVENT FIELDS ============
  // Form responses for custom fields
  formResponses: [formResponseSchema],
  
  // ============ MERCHANDISE FIELDS ============
  selectedVariant: {
    type: mongoose.Schema.Types.ObjectId,
    // Reference to variant subdocument in Event
  },
  
  variantDetails: {
    name: String,
    size: String,
    color: String,
    price: Number
  },
  
  quantity: {
    type: Number,
    min: 1,
    default: 1
  },
  
  totalAmount: {
    type: Number,
    min: 0
  },
  
  // Payment proof (for Tier A - Payment Approval Workflow)
  paymentProof: {
    type: String, // File path/URL
  },
  
  paymentStatus: {
    type: String,
    enum: ['not_required', 'pending', 'approved', 'rejected'],
    default: 'not_required'
  },
  
  // ============ QR CODE ============
  qrCodeData: {
    type: String,
    // Stores the QR code as base64 data URL
  },
  
  // ============ ATTENDANCE ============
  attended: {
    type: Boolean,
    default: false
  },
  
  attendedAt: {
    type: Date
  },
  
  // For manual attendance override (Tier A feature)
  attendanceOverride: {
    overridden: { type: Boolean, default: false },
    reason: String,
    overriddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    overriddenAt: Date
  },
  
  // ============ TEAM FIELDS (Tier A Feature) ============
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team'
  },
  
  // ============ METADATA ============
  registeredAt: {
    type: Date,
    default: Date.now
  },
  
  // Email sent flag
  confirmationEmailSent: {
    type: Boolean,
    default: false
  }
  
}, {
  timestamps: true
});

// ============ INDEXES ============
// Compound index for efficient queries (NOT unique — allows re-registration after cancel
// and multiple merchandise purchases from the same user for the same event)
registrationSchema.index({ participant: 1, event: 1 });
registrationSchema.index({ event: 1, status: 1 });
// ticketId already has unique:true in schema definition — no need for duplicate index

// ============ PRE-SAVE MIDDLEWARE ============
/**
 * Calculate total amount for merchandise
 * Note: Mongoose 9 does not pass next() to middleware — use async or plain return.
 */
registrationSchema.pre('save', function() {
  if (this.registrationType === 'merchandise' && this.variantDetails) {
    this.totalAmount = this.variantDetails.price * this.quantity;
  }
});

// ============ STATIC METHODS ============
/**
 * Get participant's registration history
 */
registrationSchema.statics.getParticipantHistory = async function(participantId) {
  return this.find({ participant: participantId })
    .populate('event', 'name eventType organizer eventStartDate eventEndDate status')
    .sort({ registeredAt: -1 });
};

/**
 * Get event registrations with filters
 */
registrationSchema.statics.getEventRegistrations = async function(eventId, filters = {}) {
  const query = { event: eventId };
  
  if (filters.status) {
    query.status = filters.status;
  }
  
  if (filters.attended !== undefined) {
    query.attended = filters.attended;
  }
  
  return this.find(query)
    .populate('participant', 'firstName lastName email contactNumber collegeName')
    .sort({ registeredAt: -1 });
};

const Registration = mongoose.model('Registration', registrationSchema);

// Sync indexes with MongoDB – drops stale unique indexes left from earlier schema versions
Registration.syncIndexes().catch(() => {});

export default Registration;
