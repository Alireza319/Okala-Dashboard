'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('node:path');
const fs = require('node:fs');

const config = require('./config');
const { initDb } = require('./db/init');
const { attachUser, requireAuth } = require('./auth/middleware');
const { RateLimiter } = require('./auth/auth');
const GoogleSheetsAdapter = require('./data/GoogleSheetsAdapter');
const { CacheStore, runRefresh } = require('./services/refresh');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const dashboardRoutes = require('./routes/dashboard');

function main() {
  // Ensure the SQLite file's directory exists.
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  const db = initDb(config.dbPath, {
    adminEmail: config.adminEmail,
    adminInitialPassword: config.adminInitialPassword,
  });

  const cacheStore = new CacheStore(config.cachePath);
  const rateLimiter = new RateLimiter({ limit: 5, windowMs: 15 * 60 * 1000 });

  let adapter = null;
  if (config.googleSheetsEndpoint) {
    adapter = new GoogleSheetsAdapter({ endpoint: config.googleSheetsEndpoint });
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      'WARNING: GOOGLE_SHEETS_ENDPOINT is not set. The dashboard will start, but /api/admin/refresh ' +
        'and all data endpoints will report NO_DATA until it is configured (see .env.example).'
    );
  }

  async function triggerRefresh(triggeredBy) {
    if (!adapter) {
      throw new Error('GOOGLE_SHEETS_ENDPOINT is not configured. Set it in .env and restart the server.');
    }
    return runRefresh({ adapter, db, cacheStore, triggeredBy, sourceSheets: config.sourceSheets });
  }

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(attachUser(db));

  app.use('/api/auth', authRoutes({ db, rateLimiter, sessionMaxAgeMs: config.sessionMaxAgeMs }));
  app.use('/api/admin', requireAuth, adminRoutes({ db, triggerRefresh }));
  app.use('/api/dashboard', dashboardRoutes({ db, cacheStore }));

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, dataSourceConfigured: !!adapter, lastRefresh: cacheStore.get()?.builtAt || null });
  });

  // Serve the frontend static build
  app.use(express.static(path.join(__dirname, '..', 'frontend')));

  app.use((err, req, res, next) => {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' });
  });

  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`OKALA Dashboard backend listening on http://localhost:${config.port}`);
  });

  // Section 6: automatic daily refresh at config.autoRefreshTime (business timezone)
  scheduleAutoRefresh(triggerRefresh);

  return app;
}

function scheduleAutoRefresh(triggerRefresh) {
  const REFRESH_INTERVAL = 60 * 60 * 1000; // 1 hour

  const loop = () => {
    setTimeout(async () => {
      try {
        await triggerRefresh('scheduler');
        console.log('Scheduled refresh completed successfully.');
      } catch (e) {
        console.error('Scheduled refresh failed:', e.message);
      }

      loop();
    }, REFRESH_INTERVAL);
  };

  loop();
}
if (require.main === module) {
  main();
}

module.exports = { main };
