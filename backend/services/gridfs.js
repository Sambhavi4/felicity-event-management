import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';

let bucket;

const init = () => {
  if (!bucket) {
    const db = mongoose.connection.db;
    bucket = new GridFSBucket(db, { bucketName: process.env.GRIDFS_BUCKET || 'uploads' });
  }
  return bucket;
};

export const uploadBufferToGridFS = async (buffer, filename, contentType = 'application/octet-stream') => {
  const b = init();
  return new Promise((resolve, reject) => {
    const uploadStream = b.openUploadStream(filename, { contentType });
    uploadStream.on('error', (err) => reject(err));
    uploadStream.on('finish', () => {
      // uploadStream.id contains the file id assigned by GridFS
      resolve(String(uploadStream.id));
    });
    uploadStream.end(buffer);
  });
};

export const getGridFSReadStream = (id) => {
  const b = init();
  try {
    return b.openDownloadStream(mongoose.Types.ObjectId(id));
  } catch (e) {
    return null;
  }
};

export default { init, uploadBufferToGridFS, getGridFSReadStream };
