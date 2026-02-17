import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';

dotenv.config({ path: path.join(process.cwd(), 'backend', '.env') });

import { uploadBufferToS3 } from '../services/s3.js';
import Registration from '../models/Registration.js';

const uploadsDir = path.join(process.cwd(), 'backend', 'uploads');

function getMimeFromExt(ext) {
  const map = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf'
  };
  return map[ext.toLowerCase()] || 'application/octet-stream';
}

async function main() {
  if (!process.env.S3_BUCKET || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error('Missing S3 env vars. Set S3_BUCKET / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI, { dbName: new URL(process.env.MONGODB_URI).pathname.replace(/^\//,'') }).catch(err => { console.error(err); process.exit(1); });

  if (!fs.existsSync(uploadsDir)) {
    console.error('No uploads directory found at', uploadsDir);
    process.exit(1);
  }

  const files = fs.readdirSync(uploadsDir).filter(f => fs.statSync(path.join(uploadsDir, f)).isFile());
  console.log('Found', files.length, 'files in uploads/');

  for (const fname of files) {
    const localPath = path.join(uploadsDir, fname);
    const key = `uploads/${fname}`;
    try {
      const buffer = fs.readFileSync(localPath);
      const url = await uploadBufferToS3(buffer, key, getMimeFromExt(path.extname(fname)));
      console.log('Uploaded', fname, '->', url);

      const uploadPath = `/uploads/${fname}`;
      const res = await Registration.updateMany({ paymentProof: uploadPath }, { $set: { paymentProof: url } });
      if (res.modifiedCount) console.log(`Updated ${res.modifiedCount} DB records for ${fname}`);
    } catch (e) {
      console.error('Error handling', fname, e);
    }
  }

  await mongoose.disconnect();
  console.log('Migration complete.');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
