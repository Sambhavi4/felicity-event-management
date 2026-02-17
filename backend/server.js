/**
 * Felicity Event Management System - Backend Server
 * 
 * ARCHITECTURE:
 * ┌─────────────────────────────────────────────────────────────┐
 * │                        Express App                          │
 * ├─────────────────────────────────────────────────────────────┤
 * │  Middleware Stack:                                          │
 * │  1. CORS - Cross-origin requests                           │
 * │  2. JSON Parser - Parse request bodies                     │
 * │  3. URL Encoded - Parse form data                          │
 * │  4. Routes - API endpoints                                 │
 * │  5. Error Handler - Catch and format errors                │
 * └─────────────────────────────────────────────────────────────┘
 * 
 * STARTUP FLOW:
 * 1. Load environment variables
 * 2. Connect to MongoDB
 * 3. Seed admin account if not exists
 * 4. Mount routes
 * 5. Start HTTP server
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '.env') });

// Database connection
import connectDB from './config/db.js';

// Routes
import {
  authRoutes,
  eventRoutes,
  registrationRoutes,
  userRoutes,
  adminRoutes,
  feedbackRoutes,
  discussionRoutes
} from './routes/index.js';
import teamRoutes from './routes/teamRoutes.js';
import debugRoutes from './routes/debugRoutes.js';
import gridfsService from './services/gridfs.js';

// Middleware
import { notFound, errorHandler } from './middleware/errorHandler.js';

// Admin seeder
import seedAdmin from './config/seedAdmin.js';
import emailService from './services/emailService.js';

// Initialize Express app
const app = express();

// ============ MIDDLEWARE ============

/**
 * CORS Configuration
 * 
 * WHY:
 * - Frontend runs on different port/domain
 * - Browsers block cross-origin requests by default
 * - CORS headers tell browser to allow requests
 */
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    // Allow any localhost port for development
    if (origin.match(/^http:\/\/localhost:\d+$/)) return callback(null, true);
    // Allow configured frontend URL
    const allowed = (process.env.FRONTEND_URL || 'http://localhost:5173');
    if (origin === allowed) return callback(null, true);
    callback(null, true); // Allow all in development
  },
  credentials: true, // Allow cookies/auth headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

/**
 * Body Parsers
 * 
 * express.json() - Parse JSON request bodies
 * express.urlencoded() - Parse form submissions
 */
app.use(express.json({ limit: '10mb' })); // Limit for QR code data
app.use(express.urlencoded({ extended: true }));

/**
 * Uploaded files handling
 * - First try local disk (for dev)
 * - If not found and S3 is configured, redirect to the S3 object URL
 */
const uploadsDir = path.join(__dirname, 'uploads');

// Serve gridfs files at /uploads/gridfs/:id
app.get('/uploads/gridfs/:id', (req, res) => {
  const stream = gridfsService.getGridFSReadStream(req.params.id);
  if (!stream) return res.status(404).json({ success: false, message: 'Not found' });
  stream.on('error', () => res.status(404).json({ success: false, message: 'Not found' }));
  stream.pipe(res);
});

app.use('/uploads', (req, res, next) => {
  const filePath = path.join(uploadsDir, req.path);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  // If S3 is configured, redirect to public S3 URL
  if (process.env.S3_BUCKET) {
    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
    const bucket = process.env.S3_BUCKET;
    const regionPart = region === 'us-east-1' ? '' : `-${region}`;
    const s3Url = `https://${bucket}.s3${regionPart}.amazonaws.com${req.path}`;
    return res.redirect(s3Url);
  }
  // Not found locally and no S3 configured
  res.status(404).json({ success: false, message: `Not found - ${req.originalUrl}` });
});

// ============ API ROUTES ============

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Felicity API is running',
    timestamp: new Date().toISOString()
  });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/discussions', discussionRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/debug', debugRoutes);

// ============ ERROR HANDLING ============

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

// ============ SERVER STARTUP ============

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to database
    await connectDB();
    
    // Seed admin account
    await seedAdmin();
    
    // Start server
    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🎉 Felicity Event Management System                     ║
║                                                           ║
║   Server running on port ${PORT}                            ║
║   Environment: ${process.env.NODE_ENV || 'development'}                           ║
║                                                           ║
║   API URL: http://localhost:${PORT}/api                     ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
      `);
    });
  // Start email worker (process queued emails)
  emailService.startWorker(5000);
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
