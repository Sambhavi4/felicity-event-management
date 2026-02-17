import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('../.env', import.meta.url).pathname });

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
const BUCKET = process.env.S3_BUCKET;

let s3 = null;
if (BUCKET && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  s3 = new S3Client({ region: REGION });
}

export const uploadBufferToS3 = async (buffer, key, contentType = 'application/octet-stream') => {
  if (!s3 || !BUCKET) throw new Error('S3 not configured');
  const params = {
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: 'public-read'
  };

  await s3.send(new PutObjectCommand(params));
  // Return the public URL (standard S3 URL)
  const regionPart = REGION === 'us-east-1' ? '' : `-${REGION}`;
  return `https://${BUCKET}.s3${regionPart}.amazonaws.com/${key}`;
};

export default { uploadBufferToS3 };
