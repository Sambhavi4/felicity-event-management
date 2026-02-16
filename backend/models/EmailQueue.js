import mongoose from 'mongoose';

const emailQueueSchema = new mongoose.Schema({
  to: { type: String, required: true },
  subject: { type: String, required: true },
  html: { type: String, required: true },
  status: { type: String, enum: ['pending', 'processing', 'sent', 'failed'], default: 'pending' },
  attempts: { type: Number, default: 0 },
  lastError: { type: String },
  sentAt: { type: Date }
}, { timestamps: true });

const EmailQueue = mongoose.model('EmailQueue', emailQueueSchema);

export default EmailQueue;
