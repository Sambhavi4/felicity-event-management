import EmailQueue from '../models/EmailQueue.js';
import sendEmail from '../utils/email.js';

const enqueue = async ({ to, subject, html, attachments }) => {
  const data = { to, subject, html, status: 'pending' };
  if (attachments && attachments.length > 0) {
    // Serialize Buffer content to base64 for MongoDB storage
    data.attachments = attachments.map(a => ({
      filename: a.filename,
      content: Buffer.isBuffer(a.content) ? a.content.toString('base64') : a.content,
      contentType: a.contentType,
      cid: a.cid,
      encoding: 'base64'
    }));
  }
  const q = await EmailQueue.create(data);
  return q;
};

const MAX_ATTEMPTS = 3;

const processPending = async () => {
  // Fetch pending emails AND failed emails that haven't exhausted retries
  const items = await EmailQueue.find({
    $or: [
      { status: 'pending' },
      { status: 'failed', attempts: { $lt: MAX_ATTEMPTS } }
    ]
  }).limit(10);
  for (const item of items) {
    try {
      item.status = 'processing';
      item.attempts += 1;
      await item.save();

      // Rebuild attachment buffers from stored base64
      const attachments = (item.attachments || []).map(a => ({
        filename: a.filename,
        content: Buffer.from(a.content, 'base64'),
        contentType: a.contentType,
        cid: a.cid
      }));

      const result = await sendEmail({ to: item.to, subject: item.subject, html: item.html, attachments });

      item.status = 'sent';
      item.sentAt = new Date();
      item.lastError = undefined;
      await item.save();
      console.log('Email sent from queue to', item.to, 'result:', result?.previewUrl || result?.info?.messageId || 'ok');
    } catch (e) {
      console.error('Queued email failed (attempt', item.attempts, '/', MAX_ATTEMPTS, '):', e.message || e);
      item.status = item.attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
      item.lastError = String(e.message || e);
      await item.save();
    }
  }
};

// Process a single queued email by id
const processOne = async (id) => {
  const item = await EmailQueue.findById(id);
  if (!item) throw new Error('Queue item not found');
  if (item.status === 'sent') return item;

  try {
    item.status = 'processing';
    item.attempts += 1;
    await item.save();

    const attachments = (item.attachments || []).map(a => ({
      filename: a.filename,
      content: Buffer.from(a.content, 'base64'),
      contentType: a.contentType,
      cid: a.cid
    }));

    const result = await sendEmail({ to: item.to, subject: item.subject, html: item.html, attachments });

    item.status = 'sent';
    item.sentAt = new Date();
    item.lastError = undefined;
    await item.save();
    console.log('Email sent from queue to', item.to, 'result:', result?.previewUrl || result?.info?.messageId || 'ok');
    return item;
  } catch (e) {
    console.error('Queued email failed:', e.message || e);
    item.status = 'failed';
    item.lastError = String(e.message || e);
    await item.save();
    throw e;
  }
};

// Start worker loop
let workerStarted = false;
const startWorker = (intervalMs = 5000) => {
  if (workerStarted) return;
  workerStarted = true;
  setInterval(() => {
    processPending().catch(err => console.error('Email worker error:', err));
  }, intervalMs);
};

export default { enqueue, processPending, processOne, startWorker };
