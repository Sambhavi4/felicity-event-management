/**
 * Team Model
 * 
 * Handles hackathon team registration with invite codes
 */

import mongoose from 'mongoose';
import crypto from 'crypto';

const teamSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  teamName: {
    type: String,
    required: [true, 'Please provide team name'],
    trim: true
  },
  teamLeader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  teamSize: {
    type: Number,
    required: true,
    min: 2
  },
  inviteCode: {
    type: String,
    unique: true,
    required: true
  },
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending'
    },
    invitedAt: {
      type: Date,
      default: Date.now
    },
    respondedAt: Date
  }],
  isComplete: {
    type: Boolean,
    default: false
  },
  registrationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Registration'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Generate unique invite code
// Note: Mongoose 9 does not pass next() to middleware — use plain return.
teamSchema.pre('save', function() {
  if (!this.inviteCode) {
    this.inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
  }
});

// Check if team is complete
teamSchema.methods.checkComplete = function() {
  const acceptedMembers = this.members.filter(m => m.status === 'accepted').length;
  this.isComplete = acceptedMembers === this.teamSize - 1; // -1 because leader is not in members array
  return this.isComplete;
};

export default mongoose.model('Team', teamSchema);
