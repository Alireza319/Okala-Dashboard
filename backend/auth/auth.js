/**
 * Auth core (Section 8, 9, 45)
 * -----------------------------
 * - Passwords hashed with Node's built-in scrypt (no external crypto dep).
 * - Sessions are opaque random tokens stored server-side (sessions table),
 *   handed to the browser as an HttpOnly, SameSite=Lax cookie. The token
 *   itself carries no information — it's a lookup key, so revocation
 *   (Section 13: "Revoke sessions") is an instant DB delete/flag, not a JWT
 *   blacklist workaround.
 * - Rate limiting is a simple in-memory sliding window per email+IP,
 *   sufficient for a small internal tool; swap for Redis if you scale out
 *   to multiple backend instances (see ARCHITECTURE.md).
 */

'use strict';

const crypto = require('node:crypto');

const SCRYPT_KEYLEN = 64;

function hashPassword(plainPassword) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plainPassword, salt, SCRYPT_KEYLEN).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(plainPassword, storedHash) {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(plainPassword, salt, SCRYPT_KEYLEN);
  const stored = Buffer.from(hash, 'hex');
  if (candidate.length !== stored.length) return false;
  return crypto.timingSafeEqual(candidate, stored);
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateInitialPassword() {
  // Readable-ish but strong enough for a one-time password the user must change immediately.
  return crypto.randomBytes(9).toString('base64url');
}

/**
 * Very small in-memory rate limiter: max `limit` attempts per `windowMs`
 * per key (e.g. `${email}:${ip}`). Good enough for a single-instance
 * deployment; not distributed-safe.
 */
class RateLimiter {
  constructor({ limit = 5, windowMs = 15 * 60 * 1000 } = {}) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.hits = new Map(); // key -> [timestamps]
  }

  check(key) {
    const now = Date.now();
    const arr = (this.hits.get(key) || []).filter((t) => now - t < this.windowMs);
    arr.push(now);
    this.hits.set(key, arr);
    return arr.length <= this.limit;
  }

  reset(key) {
    this.hits.delete(key);
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  generateInitialPassword,
  RateLimiter,
};
