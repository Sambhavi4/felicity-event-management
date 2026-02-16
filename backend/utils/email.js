/**
 * Email Utility
 * 
 * USING NODEMAILER:
 * - Most popular Node.js email library
 * - Supports multiple transports (SMTP, Gmail, SendGrid, etc.)
 * - Easy to switch providers in production
 * 
 * TEMPLATE APPROACH:
 * - HTML emails with inline styles (for email client compatibility)
 * - Functions for each email type (registration, ticket, etc.)
 * - Easy to customize and extend
 */

import nodemailer from 'nodemailer';

// Singleton transporter and state so we reuse connections and avoid per-message verify
let globalTransporter = null;
let usingTestAccount = false;
let testAccountInfo = null;

/**
 * Create a new SMTP transporter from environment variables.
 * Use pooling for better throughput and fewer auth hiccups when sending many messages.
 */
const createTransporterFromEnv = () => {
  const port = process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : 587;
  const secure = (typeof process.env.EMAIL_SECURE !== 'undefined') ? (process.env.EMAIL_SECURE === 'true') : (port === 465);
  const transport = {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port,
    secure,
    // Allow TLS connection even if self-signed certs are used in some environments
    tls: { rejectUnauthorized: process.env.EMAIL_TLS_REJECT_UNAUTHORIZED !== 'false' },
    // Use a pooled connection to improve stability for many sends
    pool: true,
    maxConnections: process.env.EMAIL_MAX_CONNECTIONS ? parseInt(process.env.EMAIL_MAX_CONNECTIONS, 10) : 5,
    maxMessages: process.env.EMAIL_MAX_MESSAGES ? parseInt(process.env.EMAIL_MAX_MESSAGES, 10) : 1000
  };
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transport.auth = { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS };
  }

  // Log masked SMTP info for debugging (do not log passwords)
  try {
    console.log(`📧 SMTP configured: host=${transport.host} port=${transport.port} secure=${transport.secure} user=${process.env.EMAIL_USER ? process.env.EMAIL_USER.replace(/(.{3}).+(@.+)/, '$1***$2') : 'not-set'}`);
  } catch (e) {
    // Ignore logging errors
  }

  return nodemailer.createTransport(transport);
};

/**
 * Send email helper function
 *
 * RESILIENT APPROACH:
 * 1. Try real SMTP credentials first (if configured).
 * 2. On auth failure (e.g. Gmail App-Password missing) fall back to Ethereal so
 *    dev/testing emails are still captured and a preview URL is logged.
 * 3. If Ethereal also fails (no internet), gracefully skip.
 */
const sendEmail = async (options) => {
  let transporter;
  let testAccount;
  let usedTestAccount = false;

  const createEtherealFallback = async () => {
    try {
      console.log('📧 Falling back to Ethereal test account for dev emails');
      const ta = await nodemailer.createTestAccount();
      const tr = nodemailer.createTransport({
        host: ta.smtp.host,
        port: ta.smtp.port,
        secure: ta.smtp.secure,
        auth: { user: ta.user, pass: ta.pass }
      });
      return { transporter: tr, testAccount: ta };
    } catch (err) {
      console.warn('⚠️  Could not create Ethereal test account:', err.message);
      return null;
    }
  };

  // If a global transporter has already been initialized, reuse it.
  if (globalTransporter) {
    transporter = globalTransporter;
    usedTestAccount = usingTestAccount;
    testAccount = testAccountInfo;
  } else {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      const fallback = await createEtherealFallback();
      if (!fallback) {
        console.warn('📧 Email will be skipped (no SMTP creds, no Ethereal).');
        return null;
      }
      transporter = fallback.transporter;
      testAccount = fallback.testAccount;
      usedTestAccount = true;
      // Save global transporter so subsequent sends reuse it
      globalTransporter = transporter;
      usingTestAccount = true;
      testAccountInfo = testAccount;
    } else {
      // Create and verify transporter once and reuse it (reduces auth flakiness)
      transporter = createTransporterFromEnv();
      try {
        await transporter.verify();
        globalTransporter = transporter;
        usingTestAccount = false;
        testAccountInfo = null;
      } catch (verifyErr) {
        console.error('❌ SMTP verification failed:', verifyErr.message);
        if (verifyErr.code === 'EAUTH' || verifyErr.responseCode === 535 || /Invalid login/i.test(String(verifyErr.message))) {
          console.error('🔒 Gmail App Password required. See https://support.google.com/accounts/answer/185833');
        }
        // In development, fall back to Ethereal so emails are still captured
        if (process.env.NODE_ENV !== 'production') {
          const fallback = await createEtherealFallback();
          if (fallback) {
            transporter = fallback.transporter;
            testAccount = fallback.testAccount;
            usedTestAccount = true;
            globalTransporter = transporter;
            usingTestAccount = true;
            testAccountInfo = testAccount;
          } else {
            console.warn('📧 Email skipped (SMTP failed, Ethereal unavailable).');
            return null;
          }
        }
        // In production, still try sending — let it fail loudly (do not overwrite globalTransporter)
      }
    }
  }

  // Default no-reply domain chosen for the project. Override the display-from with EMAIL_FROM.
  const DEFAULT_NO_REPLY = 'no-reply@felicity.iiit.ac.in';
  // Use an explicit display-from (no-reply) so recipients see a consistent sender. The SMTP
  // envelope (mailOptions.envelope.from) below still uses the auth user so delivery/auth works.
  const displayFrom = process.env.EMAIL_FROM || `"Felicity" <${process.env.EMAIL_FROM_ADDRESS || DEFAULT_NO_REPLY}>`;
  // reply-to should also default to no-reply unless overridden
  const replyToAddress = process.env.EMAIL_REPLY_TO || DEFAULT_NO_REPLY;

  const mailOptions = {
    from: displayFrom,
    to: options.to,
    subject: options.subject,
    html: options.html,
    attachments: options.attachments || []
  };
  // Helpful trace header so recipient admins can identify app-sent messages
  mailOptions.headers = Object.assign({}, options.headers || {}, { 'X-Felicity-Sent-By': 'felicity-app' });
  // Build explicit SMTP envelope (some MTAs use envelope.from for policy checks)
  const envelopeFrom = (process.env.EMAIL_USER) ? process.env.EMAIL_USER : (usedTestAccount && testAccount ? testAccount.user : undefined);
  if (envelopeFrom) {
    mailOptions.envelope = { from: envelopeFrom, to: options.to };
  }
  // Attach reply-to header so replies go to the no-reply address unless overridden
  if (replyToAddress) mailOptions.replyTo = replyToAddress;

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('📧 Email sent:', info.messageId, 'to:', mailOptions.to, 'from:', mailOptions.from);
    // Log envelope and server response for troubleshooting deliverability
    try {
      if (info.envelope) console.log('📧 Envelope:', info.envelope);
      if (info.response) console.log('📧 SMTP response:', info.response);
    } catch (e) {
      // ignore logging errors
    }
    // If using Ethereal, also return and log preview URL
    let previewUrl = null;
    try {
      previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) console.log('🔎 Preview URL:', previewUrl);
    } catch (e) {
      // ignore preview URL failures
    }
    // Return useful info for dev endpoints
    return { info, previewUrl, from: mailOptions.from };
  } catch (error) {
    // Helpful hint for common SMTP auth problems (e.g., Gmail rejects plain password)
    console.error('❌ Email error:', error);
    if (error && (error.code === 'EAUTH' || error.responseCode === 535 || /Invalid login/i.test(String(error.message)))) {
      console.error('🔒 SMTP authentication failed. If you are using Gmail, ensure you have created an App Password (recommended) or enabled appropriate SMTP access for this account. See: https://support.google.com/mail/?p=BadCredentials');
    }
    throw error;
  }
};

/**
 * Send registration confirmation email with ticket
 */
export const sendRegistrationEmail = async (participant, event, registration) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .ticket { background: white; border: 2px dashed #667eea; padding: 20px; margin: 20px 0; border-radius: 10px; }
        .ticket-id { font-size: 24px; font-weight: bold; color: #667eea; text-align: center; }
        .details { margin: 15px 0; }
        .details p { margin: 5px 0; }
        .qr-container { text-align: center; margin: 20px 0; }
        .qr-container img { max-width: 200px; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Registration Confirmed!</h1>
          <p>Felicity 2026</p>
        </div>
        <div class="content">
          <p>Hi <strong>${participant.firstName}</strong>,</p>
          <p>Your registration for <strong>${event.name}</strong> has been confirmed!</p>
          
          <div class="ticket">
            <p class="ticket-id">🎫 ${registration.ticketId}</p>
            <div class="details">
              <p><strong>Event:</strong> ${event.name}</p>
              <p><strong>Date:</strong> ${new Date(event.eventStartDate).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              <p><strong>Venue:</strong> ${event.venue || 'To be announced'}</p>
            </div>
            ${registration.qrCodeData ? `
              <div class="qr-container">
                <img src="${registration.qrCodeData}" alt="QR Code" />
                <p style="font-size: 12px; color: #666;">Show this QR code at the venue</p>
              </div>
            ` : ''}
          </div>
          
          <p>Keep this email safe. You'll need to show the QR code or ticket ID at the venue.</p>
          
          <div class="footer">
            <p>This is an automated email from Felicity Event Management System.</p>
            <p>If you didn't register for this event, please contact us immediately.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail({
    to: participant.email,
    subject: `🎫 Registration Confirmed - ${event.name} | Felicity 2026`,
    html
  });
};

/**
 * Send merchandise purchase confirmation
 */
export const sendMerchandiseEmail = async (participant, event, registration) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .order { background: white; border: 2px solid #11998e; padding: 20px; margin: 20px 0; border-radius: 10px; }
        .order-id { font-size: 20px; font-weight: bold; color: #11998e; }
        .item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
        .total { font-size: 18px; font-weight: bold; margin-top: 15px; }
        .qr-container { text-align: center; margin: 20px 0; }
        .qr-container img { max-width: 200px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🛍️ Order Confirmed!</h1>
          <p>Felicity Merchandise</p>
        </div>
        <div class="content">
          <p>Hi <strong>${participant.firstName}</strong>,</p>
          <p>Your merchandise order has been confirmed!</p>
          
          <div class="order">
            <p class="order-id">Order ID: ${registration.ticketId}</p>
            <div class="item">
              <span>${registration.variantDetails?.name || event.name}</span>
              <span>x${registration.quantity}</span>
            </div>
            ${registration.variantDetails?.size ? `<p>Size: ${registration.variantDetails.size}</p>` : ''}
            ${registration.variantDetails?.color ? `<p>Color: ${registration.variantDetails.color}</p>` : ''}
            <p class="total">Total: ₹${registration.totalAmount}</p>
          </div>
          
          ${registration.qrCodeData ? `
            <div class="qr-container">
              <img src="${registration.qrCodeData}" alt="QR Code" />
              <p style="font-size: 12px; color: #666;">Show this QR code for pickup</p>
            </div>
          ` : ''}
          
          <p>Show this email or the QR code when collecting your merchandise.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail({
    to: participant.email,
    subject: `🛍️ Order Confirmed - ${event.name} | Felicity 2026`,
    html
  });
};

/**
 * Send organizer credentials
 */
export const sendOrganizerCredentials = async (loginEmail, password, organizerName, deliveryEmail) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .credentials { background: white; border: 2px solid #f5576c; padding: 20px; margin: 20px 0; border-radius: 10px; }
        .credential-item { margin: 10px 0; }
        .credential-item strong { color: #f5576c; }
        .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎪 Welcome to Felicity!</h1>
          <p>Organizer Account Created</p>
        </div>
        <div class="content">
          <p>Hi <strong>${organizerName}</strong>,</p>
          <p>Your organizer account has been created for Felicity Event Management System.</p>
          
          <div class="credentials">
            <h3>Your Login Credentials</h3>
            <div class="credential-item">
              <strong>Login Email:</strong> ${loginEmail}
            </div>
            <div class="credential-item">
              <strong>Password:</strong> ${password}
            </div>
          </div>
          
          <div class="warning">
            ⚠️ <strong>Important:</strong> Please change your password after first login for security.
          </div>
          
          <p>You can now login to create and manage events for your club/organization.</p>
          <p><a href="${process.env.FRONTEND_URL}/login">Login to Felicity</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail({
    to: deliveryEmail || loginEmail,
    subject: `🎪 Your Felicity Organizer Account - ${organizerName}`,
    html
  });
};

export default sendEmail;
