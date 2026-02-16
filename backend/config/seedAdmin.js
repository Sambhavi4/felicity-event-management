/**
 * Admin Seeder
 * 
 * PURPOSE:
 * - Creates the initial admin account
 * - Required as per spec: Admin is first user, provisioned by backend
 * 
 * USAGE:
 * npm run seed
 * 
 * OR automatically runs on server start if no admin exists
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const seedAdmin = async () => {
  try {
    // Connect to database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('Connected to MongoDB');
    }
    
    // Check if admin exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    
    if (existingAdmin) {
      console.log('✅ Admin account already exists:', existingAdmin.email);
      return existingAdmin;
    }
    
    // Create admin
    const admin = await User.create({
      email: process.env.ADMIN_EMAIL || 'admin@felicity.iiit.ac.in',
      password: process.env.ADMIN_PASSWORD || 'Admin@123',
      role: 'admin',
      firstName: 'System',
      lastName: 'Admin',
      isActive: true,
      onboardingCompleted: true
    });
    
    console.log('✅ Admin account created successfully');
    console.log('   Email:', admin.email);
    console.log('   Password:', process.env.ADMIN_PASSWORD || 'Admin@123');
    
    return admin;
    
  } catch (error) {
    console.error('❌ Error seeding admin:', error);
    throw error;
  }
};

// Run if called directly
if (process.argv[1].includes('seedAdmin')) {
  seedAdmin()
    .then(() => {
      console.log('Seeding complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

export default seedAdmin;
