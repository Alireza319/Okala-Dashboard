'use strict';

const express = require('express');
const { verifyPassword, hashPassword, generateSessionToken } = require('../auth/auth');

function authRoutes({ db, rateLimiter, sessionMaxAgeMs }) {
  const router = express.Router();

  function logLogin({ email, role, success, failureReason, ip }) {
    db.prepare(
      `INSERT INTO login_logs (email, role, success, failure_reason, ip) VALUES (?, ?, ?, ?, ?)`
    ).run(email, role || null, success ? 1 : 0, failureReason || null, ip || null);
  }

  router.post('/login', (req, res) => {
    const { email, password } = req.body || {};
    const ip = req.ip;

    if (!email || !password) {
      return res.status(400).json({ error: 'MISSING_FIELDS', message: 'Corporate email and password are required.' });
    }

    const rlKey = `${email.toLowerCase()}:${ip}`;
    if (!rateLimiter.check(rlKey)) {
      logLogin({ email, success: false, failureReason: 'RATE_LIMITED', ip });
      return res.status(429).json({ error: 'RATE_LIMITED', message: 'Too many login attempts. Try again later.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user || user.status !== 'active' || !verifyPassword(password, user.password_hash)) {
      logLogin({ email, success: false, failureReason: 'INVALID_CREDENTIALS', ip });
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
    }

    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + sessionMaxAgeMs).toISOString();
    db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(token, user.id, expiresAt);

    const isFirstLogin = !user.first_login_at;
    db.prepare(
      `UPDATE users SET last_login_at = datetime('now'), first_login_at = COALESCE(first_login_at, datetime('now')) WHERE id = ?`
    ).run(user.id);

    rateLimiter.reset(rlKey);
    logLogin({ email, role: user.role, success: true, ip });

    res.cookie('session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionMaxAgeMs,
    });

    res.json({
      user: {
        email: user.email,
        name: user.name,
        role: user.role,
        assignedAgent: user.assigned_agent,
        mustChangePassword: !!user.must_change_password,
      },
      isFirstLogin,
    });
  });

  router.post('/logout', (req, res) => {
    const token = req.cookies && req.cookies.session;
    if (token) {
      db.prepare('UPDATE sessions SET revoked = 1 WHERE id = ?').run(token);
    }
    res.clearCookie('session');
    res.json({ ok: true });
  });

  router.post('/change-password', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'NOT_AUTHENTICATED' });
    const { currentPassword, newPassword } = req.body || {};
    if (!newPassword || newPassword.length < 10) {
      return res.status(400).json({ error: 'WEAK_PASSWORD', message: 'New password must be at least 10 characters.' });
    }
    const dbUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!req.user.mustChangePassword && !verifyPassword(currentPassword || '', dbUser.password_hash)) {
      return res.status(401).json({ error: 'INVALID_CURRENT_PASSWORD' });
    }
    const newHash = hashPassword(newPassword);
    db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(newHash, req.user.id);
    // Section 45: invalidate other sessions after a password reset/change
    db.prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ? AND id != ?').run(
      req.user.id,
      req.cookies.session
    );
    db.prepare(`INSERT INTO activity_logs (user_email, action) VALUES (?, 'User changed password')`).run(
      req.user.email
    );
    res.json({ ok: true });
  });

  router.get('/me', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'NOT_AUTHENTICATED' });
    res.json({ user: req.user });
  });

  return router;
}

module.exports = authRoutes;
