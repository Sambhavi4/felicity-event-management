/**
 * File Upload Middleware
 * 
 * Uses multer for handling file uploads (payment proofs, etc.)
 */

import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { uploadBufferToS3 } from '../services/s3.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const localDiskStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// If S3 is configured (S3_BUCKET env), use memory storage and then upload buffer to S3
const memory = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp|pdf/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (ext && mime) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (jpeg, jpg, png, gif, webp) and PDFs are allowed'), false);
  }
};

const useS3 = !!process.env.S3_BUCKET;

export const upload = multer({
  storage: useS3 ? memory : localDiskStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
});

// Middleware to upload the received file buffer to S3 when configured.
export const uploadToS3 = async (req, res, next) => {
  if (!useS3) return next();
  if (!req.file || !req.file.buffer) return next();

  try {
    const originalName = req.file.originalname || 'file';
    const key = `uploads/${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(originalName)}`;
    const result = await uploadBufferToS3(req.file.buffer, key, req.file.mimetype);
    // Attach s3Url so downstream handlers can persist it
    req.file.s3Url = result;
    // Also set filename for compatibility
    req.file.filename = path.basename(key);
    return next();
  } catch (err) {
    console.error('S3 upload failed:', err);
    return next(err);
  }
};
