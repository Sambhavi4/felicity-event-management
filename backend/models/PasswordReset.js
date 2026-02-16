import mongoose from 'mongoose';

const passwordResetSchema = new mongoose.Schema({
  organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requestedBy: { type: String, default: 'organizer' }, // who requested: organizer or admin
  reason: { type: String, default: '' },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  adminComment: { type: String },
  temporaryPassword: { type: String },
  requestedAt: { type: Date, default: Date.now },
  actionedAt: { type: Date }
}, { timestamps: true });

const PasswordReset = mongoose.model('PasswordReset', passwordResetSchema);

export default PasswordReset;
