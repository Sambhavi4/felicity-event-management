/**
 * Database Configuration
 * 
 * WHY MONGOOSE?
 * - Mongoose provides schema validation, type casting, and query building
 * - It adds a layer of structure on top of MongoDB's flexible document model
 * - Helps maintain data consistency across the application
 * 
 * CONNECTION OPTIMIZATION:
 * - useNewUrlParser: Uses new MongoDB driver's URL parser
 * - useUnifiedTopology: Uses new Server Discovery and Monitoring engine
 * - These options are now default in Mongoose 6+, but kept for clarity
 */

import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    // Mongoose connection with timeout to avoid hanging
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000, // Fail fast if can't connect in 10s
      socketTimeoutMS: 45000,
    });
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // Handle connection events for better debugging
    mongoose.connection.on('error', (err) => {
      console.error(`❌ MongoDB connection error: ${err}`);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected. Attempting to reconnect...');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });
    
  } catch (error) {
    console.error(`❌ Error connecting to MongoDB: ${error.message}`);
    if (error.message.includes('whitelist') || error.message.includes('ENOTFOUND') || error.message.includes('Could not connect')) {
      console.error(`\n⚠️  Your IP is not whitelisted in MongoDB Atlas!`);
      console.error(`   Go to: https://cloud.mongodb.com → Network Access → Add Current IP`);
      console.error(`   Or add 0.0.0.0/0 to allow all IPs (for development)\n`);
    }
    // Exit process with failure - let the process manager restart
    process.exit(1);
  }
};

export default connectDB;
