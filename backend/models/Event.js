/**
 * Event Model
 * 
 * DESIGN DECISIONS:
 * 
 * 1. EVENT TYPES
 *    - 'normal': Regular events (workshops, talks, competitions)
 *    - 'merchandise': For selling items (T-shirts, hoodies, kits)
 * 
 * 2. STATUS WORKFLOW
 *    draft → published → ongoing → completed
 *                    ↘ closed (cancelled)
 * 
 * 3. DYNAMIC FORM BUILDER
 *    - customFields array stores form schema
 *    - Each field has type, label, required flag, and options
 *    - Flexible enough for any registration needs
 * 
 * 4. MERCHANDISE HANDLING
 *    - variants array for size/color combinations
 *    - Stock tracking at variant level
 *    - Purchase limit per participant
 */

import mongoose from 'mongoose';

// Schema for custom form fields (Form Builder)
const customFieldSchema = new mongoose.Schema({
  fieldId: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['text', 'textarea', 'number', 'email', 'dropdown', 'checkbox', 'radio', 'file'],
    required: true
  },
  label: {
    type: String,
    required: true,
    trim: true
  },
  placeholder: {
    type: String,
    trim: true
  },
  required: {
    type: Boolean,
    default: false
  },
  options: [{
    type: String // For dropdown, checkbox, radio
  }],
  order: {
    type: Number,
    default: 0
  }
}, { _id: false });

// Schema for merchandise variants
const variantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  size: {
    type: String,
    trim: true
  },
  color: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  stock: {
    type: Number,
    required: true,
    min: 0
  },
  sold: {
    type: Number,
    default: 0
  }
});

const eventSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'Event name is required'],
    trim: true,
    maxlength: [100, 'Event name cannot exceed 100 characters']
  },
  
  description: {
    type: String,
    required: [true, 'Event description is required'],
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  
  eventType: {
    type: String,
    enum: ['normal', 'merchandise'],
    required: true
  },
  
  // Organizer reference
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Event Status
  status: {
    type: String,
    enum: ['draft', 'published', 'ongoing', 'completed', 'closed'],
    default: 'draft'
  },
  
  // Dates
  registrationDeadline: {
    type: Date,
    required: [true, 'Registration deadline is required']
  },
  
  eventStartDate: {
    type: Date,
    required: [true, 'Event start date is required']
  },
  
  eventEndDate: {
    type: Date,
    required: [true, 'Event end date is required']
  },
  
  // Eligibility
  eligibility: {
    type: String,
    enum: ['all', 'iiit-only', 'non-iiit-only'],
    default: 'all'
  },
  
  // Registration Settings
  registrationLimit: {
    type: Number,
    min: [1, 'Registration limit must be at least 1'],
    default: 100
  },
  
  registrationCount: {
    type: Number,
    default: 0
  },
  
  registrationFee: {
    type: Number,
    min: 0,
    default: 0
  },
  
  // Tags for search and recommendations
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  
  // ============ NORMAL EVENT FIELDS ============
  // Custom registration form
  customFields: [customFieldSchema],
  
  // Flag to lock form after first registration
  formLocked: {
    type: Boolean,
    default: false
  },
  
  // Venue/Location
  venue: {
    type: String,
    trim: true
  },
  
  // ============ MERCHANDISE EVENT FIELDS ============
  variants: [variantSchema],
  
  // Max items a participant can purchase
  purchaseLimit: {
    type: Number,
    min: 1,
    default: 5
  },
  
    // If true, merchandise purchases require manual payment proof and organizer approval
    requiresPaymentApproval: {
      type: Boolean,
      default: true
    },
  
  // ============ ANALYTICS ============
  viewCount: {
    type: Number,
    default: 0
  },
  
  // For trending calculation
  recentViews: [{
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  // Recent registrations timestamps (used to compute trending based on recent signups/purchases)
  recentRegistrations: [{
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  // ============ IMAGES ============
  coverImage: {
    type: String, // URL or file path
  },
  
  // ============ TEAM EVENT FIELDS (for Tier A Feature) ============
  isTeamEvent: {
    type: Boolean,
    default: false
  },
  
  minTeamSize: {
    type: Number,
    min: 2
  },
  
  maxTeamSize: {
    type: Number
  }
  
}, {
  timestamps: true
});

// ============ INDEXES ============
// For searching events
eventSchema.index({ name: 'text', description: 'text', tags: 'text' });

// For filtering by organizer and status
eventSchema.index({ organizer: 1, status: 1 });

// For date-based queries
eventSchema.index({ eventStartDate: 1 });
eventSchema.index({ registrationDeadline: 1 });

// ============ VIRTUAL PROPERTIES ============
/**
 * Check if registration is open
 */
eventSchema.virtual('isRegistrationOpen').get(function() {
  const now = new Date();
  return (
    this.status === 'published' &&
    now < this.registrationDeadline &&
    this.registrationCount < this.registrationLimit
  );
});

/**
 * Calculate total stock for merchandise
 */
eventSchema.virtual('totalStock').get(function() {
  if (this.eventType !== 'merchandise' || !this.variants) return null;
  return this.variants.reduce((sum, v) => sum + v.stock, 0);
});

/**
 * Calculate total sold for merchandise
 */
eventSchema.virtual('totalSold').get(function() {
  if (this.eventType !== 'merchandise' || !this.variants) return null;
  return this.variants.reduce((sum, v) => sum + v.sold, 0);
});

// Ensure virtuals are included in JSON output
eventSchema.set('toJSON', { virtuals: true });
eventSchema.set('toObject', { virtuals: true });

// ============ STATIC METHODS ============
/**
 * Get trending events (most viewed in last 24 hours, falls back to most popular published events)
 */
eventSchema.statics.getTrending = async function(limit = 5) {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  let events = await this.aggregate([
    {
      $match: {
        status: 'published'
      }
    },
    {
      $addFields: {
        recentViewCount: {
          $size: {
            $filter: {
              input: { $ifNull: ['$recentViews', []] },
              as: 'view',
              cond: { $gte: ['$$view.timestamp', twentyFourHoursAgo] }
            }
          }
        }
        ,
        recentRegistrationCount: {
          $size: {
            $filter: {
              input: { $ifNull: ['$recentRegistrations', []] },
              as: 'reg',
              cond: { $gte: ['$$reg.timestamp', twentyFourHoursAgo] }
            }
          }
        }
      }
    },
    // Sort by recent registrations first, then recent views, then overall popularity
    { $sort: { recentRegistrationCount: -1, recentViewCount: -1, registrationCount: -1, viewCount: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: 'organizer',
        foreignField: '_id',
        as: 'organizer'
      }
    },
    { $unwind: { path: '$organizer', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        name: 1,
        description: 1,
        eventType: 1,
        eventStartDate: 1,
        eventEndDate: 1,
        registrationDeadline: 1,
        registrationCount: 1,
        registrationLimit: 1,
        registrationFee: 1,
        venue: 1,
        tags: 1,
        eligibility: 1,
        status: 1,
        viewCount: 1,
        recentViewCount: 1,
        'organizer._id': 1,
        'organizer.organizerName': 1,
        'organizer.category': 1
      }
    }
  ]);

  return events;
};

// Personalized recommendations based on interests and followed organizers
eventSchema.statics.getRecommendations = async function(limit = 5, options = {}) {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const { userInterests = [], followedOrganizers = [] } = options || {};

  const interestsLower = (userInterests || []).map(i => String(i).toLowerCase());
  const followedIds = (followedOrganizers || []).map(id => String(id));

  const pipeline = [
    { $match: { status: 'published' } },
    { $addFields: {
        recentViewCount: {
          $size: {
            $filter: {
              input: { $ifNull: ['$recentViews', []] },
              as: 'view',
              cond: { $gte: ['$$view.timestamp', twentyFourHoursAgo] }
            }
          }
        },
        recentRegistrationCount: {
          $size: {
            $filter: {
              input: { $ifNull: ['$recentRegistrations', []] },
              as: 'reg',
              cond: { $gte: ['$$reg.timestamp', twentyFourHoursAgo] }
            }
          }
        }
    } },
    { $lookup: { from: 'users', localField: 'organizer', foreignField: '_id', as: 'organizer' } },
    { $unwind: { path: '$organizer', preserveNullAndEmptyArrays: true } }
  ];

  if (interestsLower.length > 0 || followedIds.length > 0) {
    pipeline.push({
      $addFields: {
        tagMatchCount: {
          $size: {
            $filter: {
              input: { $ifNull: ['$tags', []] },
              as: 'tag',
              cond: {
                $gt: [
                  {
                    $size: {
                      $filter: {
                        input: interestsLower,
                        as: 'userInt',
                        cond: {
                          $or: [
                            { $regexMatch: { input: { $toLower: '$$tag' }, regex: '$$userInt' } },
                            { $regexMatch: { input: '$$userInt', regex: { $toLower: '$$tag' } } }
                          ]
                        }
                      }
                    }
                  }, 0
                ]
              }
            }
          }
        },
        organizerFollowed: { $in: [ { $toString: '$organizer._id' }, followedIds ] },
        organizerCategoryLower: { $toLower: '$organizer.category' }
      }
    });

    pipeline.push({
      $addFields: {
        _personalBoost: {
          $add: [
            { $cond: [{ $eq: ['$organizerFollowed', true] }, 12, 0] },
            { $multiply: ['$tagMatchCount', 4] },
            { $cond: [{ $in: ['$organizerCategoryLower', interestsLower ] }, 6, 0] },
            // small weight for recent registrations to keep recommendations fresh
            { $multiply: ['$recentRegistrationCount', 1] }
          ]
        }
      }
    });

    pipeline.push({ $sort: { _personalBoost: -1, recentRegistrationCount: -1, recentViewCount: -1, registrationCount: -1, viewCount: -1 } });
  } else {
    pipeline.push({ $sort: { recentRegistrationCount: -1, recentViewCount: -1, registrationCount: -1, viewCount: -1 } });
  }

  pipeline.push({ $limit: limit });

  pipeline.push({ $project: {
    _id: 1,
    name: 1,
    description: 1,
    eventType: 1,
    eventStartDate: 1,
    eventEndDate: 1,
    registrationDeadline: 1,
    registrationCount: 1,
    registrationLimit: 1,
    registrationFee: 1,
    venue: 1,
    tags: 1,
    eligibility: 1,
    status: 1,
    viewCount: 1,
    recentViewCount: 1,
    recentRegistrationCount: 1,
    'organizer._id': 1,
    'organizer.organizerName': 1,
    'organizer.category': 1,
    _personalBoost: 1
  } });

  const events = await this.aggregate(pipeline);
  return events;
};

const Event = mongoose.model('Event', eventSchema);

export default Event;
