/**
 * File Upload Middleware
 * 
 * Uses multer for handling file uploads (payment proofs, etc.)
 */

import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { uploadBufferToGridFS } from '../services/gridfs.js';

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

const useGridFS = !!process.env.USE_GRIDFS || (process.env.NODE_ENV === 'production');

export const upload = multer({
  storage: useGridFS ? memory : localDiskStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
});

// Middleware to upload the received file buffer to S3 or GridFS when configured.
export const uploadToStorage = async (req, res, next) => {
  if (!req.file || !req.file.buffer) return next();

  try {
    if (useGridFS) {
      const originalName = req.file.originalname || 'file';
      const gridId = await uploadBufferToGridFS(req.file.buffer, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(originalName)}`, req.file.mimetype);
      req.file.gridFsId = gridId;
      req.file.filename = path.basename(originalName);
      return next();
    }

    return next();
  } catch (err) {
    console.error('Storage upload failed:', err);
    return next(err);
  }
};
