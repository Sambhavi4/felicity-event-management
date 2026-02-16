#!/usr/bin/env node
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';
import emailService from '../services/emailService.js';

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);

  console.log('Finding all active users...');
  const users = await User.find({ isActive: true }).select('email').lean();

  if (!users || users.length === 0) {
    console.log('No active users found. Exiting.');
    process.exit(0);
  }

  console.log(`Enqueuing test email for ${users.length} users (including iiit addresses)...`);
  const enqueues = users.map(u => emailService.enqueue({
    to: u.email,
    subject: 'Felicity Test Broadcast',
    html: `<p>This is a test broadcast from Felicity — please ignore.</p>`
  }));

  await Promise.all(enqueues);
  console.log(`Enqueued ${users.length} messages. The background worker will process them shortly.`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
