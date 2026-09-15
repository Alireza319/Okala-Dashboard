/**
 * Authorization middleware (Sections 10-12, 45)
 * ------------------------------------------------
 * CRITICAL: authorization is enforced HERE, server-side, on every request —
 * never trust a role or agent identity sent from the frontend. An Agent
 * hitting /api/agent?id=another-agent must be blocked by this layer
 * regardless of what the URL says, because req.user.assignedAgent comes
 * from the session record in the database, not from the request.
 */

'use strict';

function attachUser(db) {
  return (req, res, next) => {
    const token = req.cookies && req.cookies.session;
    if (!token) {
      req.user = null;
      return next();
    }
    const row = db
      .prepare(
        `SELECT s.id as session_id, s.expires_at, s.revoked, u.*
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.id = ?`
      )
      .get(token);

    if (!row || row.revoked || new Date(row.expires_at) < new Date() || row.status !== 'active') {
      req.user = null;
      return next();
    }

    req.user = {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      assignedAgent: row.assigned_agent,
      mustChangePassword: !!row.must_change_password,
    };
    db.prepare('UPDATE users SET last_activity_at = datetime(\'now\') WHERE id = ?').run(row.id);
    next();
  };
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'NOT_AUTHENTICATED', message: 'Please log in.' });
  }
  next();
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'NOT_AUTHENTICATED', message: 'Please log in.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

/**
 * For agent-scoped data endpoints: forces the effective agent filter to be
 * the caller's own assigned agent when role==='agent', ignoring/overriding
 * anything the client sent in the query string. Admin/Manager may pass an
 * explicit ?agent= to filter; Agents may not.
 */
function scopeToOwnAgent(req, res, next) {
  if (req.user.role === 'agent') {
    if (!req.user.assignedAgent) {
      return res.status(403).json({
        error: 'NO_AGENT_ASSIGNED',
        message: 'Your account has no assigned Agent identity. Contact your Admin.',
      });
    }
    req.effectiveAgent = req.user.assignedAgent; // routes must use THIS, not req.query.agent
  } else {
    req.effectiveAgent = req.query.agent || null; // Admin/Manager may optionally filter
  }
  next();
}

module.exports = { attachUser, requireAuth, requireRole, scopeToOwnAgent };
