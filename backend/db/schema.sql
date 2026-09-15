-- OKALA Dashboard database schema (Sections 13, 14, 25, 26, 42, 57, 58)
-- Google Sheets is NEVER the auth database — this is.
-- Uses SQLite by default (zero setup); swap to Postgres later by pointing
-- config.js at a different connection string (see ARCHITECTURE.md).

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'agent')),
  assigned_agent TEXT,               -- for role='agent': the Agent identity this email maps to
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  must_change_password INTEGER NOT NULL DEFAULT 1,
  first_login_at TEXT,
  last_login_at TEXT,
  last_activity_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,               -- random session token, stored in an HttpOnly cookie
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS login_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  role TEXT,
  success INTEGER NOT NULL,
  failure_reason TEXT,
  login_at TEXT NOT NULL DEFAULT (datetime('now')),
  logout_at TEXT,
  ip TEXT
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL,
  action TEXT NOT NULL,              -- e.g. "User changed password", "Admin triggered refresh"
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS refresh_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  triggered_by TEXT NOT NULL,        -- 'scheduler' or a user email
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  stage_failed TEXT,
  error_message TEXT,
  rows_processed INTEGER,
  rows_accepted INTEGER,
  rows_rejected INTEGER,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);

-- Section 25/42: Admin-configurable KPI targets, scoped by City+Provider+KPI+period
CREATE TABLE IF NOT EXISTS kpi_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  city TEXT NOT NULL,                -- 'Tehran' | 'Other Cities'
  provider TEXT NOT NULL,            -- 'Supermarket' | 'Other Service'
  kpi TEXT NOT NULL,                 -- 'NFC' | 'Cancel' | 'Return' | ... (matches bonusEngine kpi names)
  target REAL,
  lower_boundary_pct REAL,           -- optional override of the KPI's default scoring shape
  upper_boundary_pct REAL,
  bonus_amount REAL NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_kpi_config_lookup ON kpi_config (city, provider, kpi, active);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
