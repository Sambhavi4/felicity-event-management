/**
 * User Model - Handles all user types: Participant, Organizer, Admin
 * 
 * DESIGN DECISIONS:
 * 
 * 1. SINGLE COLLECTION STRATEGY
 *    - All user types in one collection with 'role' discriminator
 *    - Pros: Simpler auth logic, easier querying, no joins needed
 *    - Cons: Some fields unused for certain roles (handled with conditional validation)
 * 
 * 2. PASSWORD SECURITY
 *    - bcrypt with salt rounds of 12 (2^12 = 4096 iterations)
 *    - Higher rounds = more secure but slower
 *    - 12 is a good balance for 2024 hardware
 * 
 * 3. INDEXES
 *    - email: unique index for fast lookups and uniqueness constraint
 *    - role: regular index for filtering by role
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  // Common fields for all users
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email'
    ]
  },
  
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't return password in queries by default
  },
  
  role: {
    type: String,
    enum: ['participant', 'organizer', 'admin'],
    default: 'participant'
  },
  
  // ============ PARTICIPANT SPECIFIC FIELDS ============
  firstName: {
    type: String,
    trim: true,
    // Required only for participants - validated in controller
  },
  
  lastName: {
    type: String,
    trim: true,
  },
  
  participantType: {
    type: String,
    enum: ['iiit', 'non-iiit'],
    // Required only for participants
  },
  
  collegeName: {
    type: String,
    trim: true,
  },
  
  contactNumber: {
    type: String,
    trim: true,
    match: [/^[0-9]{10}$/, 'Please provide a valid 10-digit phone number']
  },
  
  // Participant preferences (for personalization)
  interests: [{
    type: String,
    trim: true
  }],
  
  followedOrganizers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // References organizer accounts
  }],
  
  // ============ ORGANIZER SPECIFIC FIELDS ============
  organizerName: {
    type: String,
    trim: true,
    // Required for organizers
  },
  
  category: {
    type: String,
    enum: ['technical', 'cultural', 'sports', 'literary', 'gaming', 'other'],
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  
  contactEmail: {
    type: String,
    trim: true,
    lowercase: true
  },
  
  discordWebhook: {
    type: String,
    trim: true,
    // For auto-posting events to Discord
  },
  
  // ============ ACCOUNT STATUS ============
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Onboarding completed flag
  onboardingCompleted: {
    type: Boolean,
    default: false
  },
  
  // Password reset fields
  passwordResetRequested: {
    type: Boolean,
    default: false
  },
  
  passwordResetRequestDate: {
    type: Date
  }
  
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// ============ INDEXES ============
// Compound index for efficient role-based queries
userSchema.index({ role: 1, isActive: 1 });

// ============ PRE-SAVE MIDDLEWARE ============
/**
 * Hash password before saving
 * 
 * WHY PRE-SAVE HOOK?
 * - Automatically handles password hashing whenever password changes
 * - Works for both new users and password updates
 * - Keeps controller code clean
 * 
 * isModified() check prevents re-hashing already hashed passwords
 */
// Use async middleware without next() to avoid Mongoose middleware signature issues
userSchema.pre('save', async function() {
  // Only hash if password is modified (or new)
  if (!this.isModified('password')) return;

  // Generate salt and hash
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// ============ INSTANCE METHODS ============
/**
 * Compare entered password with stored hash
 * 
 * WHY INSTANCE METHOD?
 * - Encapsulates password comparison logic in the model
 * - Can be called on any user document: user.comparePassword(enteredPassword)
 */
userSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

/**
 * Get public profile (exclude sensitive data)
 */
userSchema.methods.getPublicProfile = function() {
  const user = this.toObject();
  delete user.password;
  delete user.__v;
  return user;
};

const User = mongoose.model('User', userSchema);

export default User;
