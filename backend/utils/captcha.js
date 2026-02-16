/**
 * CAPTCHA Utility
 * 
 * Server-side CAPTCHA generation and verification using svg-captcha.
 * Stores CAPTCHA answers in an in-memory map with automatic TTL cleanup.
 */

import svgCaptcha from 'svg-captcha';
import crypto from 'crypto';

// In-memory store: captchaId -> { text, expiresAt }
const captchaStore = new Map();

// Clean up expired entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of captchaStore) {
    if (entry.expiresAt < now) {
      captchaStore.delete(id);
    }
  }
}, 60_000);

/**
 * Generate a new CAPTCHA
 * @returns {{ id: string, svg: string }} captcha ID and SVG image
 */
export function generateCaptcha() {
  const captcha = svgCaptcha.create({
    size: 5,          // 5 characters
    noise: 3,         // noise lines
    color: true,
    background: '#f0f0f0',
    width: 180,
    height: 50,
    fontSize: 42,
  });

  const id = crypto.randomBytes(16).toString('hex');

  captchaStore.set(id, {
    text: captcha.text.toLowerCase(),
    expiresAt: Date.now() + 5 * 60 * 1000, // 5-minute TTL
  });

  return { id, svg: captcha.data };
}

/**
 * Verify a CAPTCHA answer
 * @param {string} captchaId - The CAPTCHA token/ID
 * @param {string} captchaAnswer - User's answer
 * @returns {boolean} true if correct
 */
export function verifyCaptcha(captchaId, captchaAnswer) {
  if (!captchaId || !captchaAnswer) return false;

  const entry = captchaStore.get(captchaId);
  if (!entry) return false;

  // Delete after use (one-time use)
  captchaStore.delete(captchaId);

  // Check expiry
  if (entry.expiresAt < Date.now()) return false;

  return entry.text === captchaAnswer.trim().toLowerCase();
}
