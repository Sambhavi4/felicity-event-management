#!/usr/bin/env node
/**
 * Migration script: set requiresPaymentApproval=true for existing merchandise events
 * Usage: node scripts/migrate-requires-payment-approval.js
 * (Ensure NODE_ENV and DB connection env vars are set as in server.js)
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
import Event from '../models/Event.js';

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/felicity';

async function run() {
  console.log('Connecting to', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  const res = await Event.updateMany({ eventType: 'merchandise', requiresPaymentApproval: { $ne: true } }, { $set: { requiresPaymentApproval: true } });
  console.log('Updated', res.nModified || res.modifiedCount || res.modified, 'events');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
