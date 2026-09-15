'use strict';

require('dotenv').config();

function required(name, fallback) {
  const v = process.env[name] ?? fallback;
  return v;
}

module.exports = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Section 43: the ONE thing an admin should mostly need to configure.
  googleSheetsEndpoint: required('GOOGLE_SHEETS_ENDPOINT'),
  sourceSheets: (process.env.SOURCE_SHEETS || 'Sales & cub,Other (sales & cub),Assortment,Ops Performance,Compensation,Availability')
    .split(',')
    .map((s) => s.trim()),

  adminEmail: required('ADMIN_EMAIL', 'alirezamohamadi319@gmail.com'),
  adminInitialPassword: process.env.ADMIN_INITIAL_PASSWORD || null,

  dbPath: required('DB_PATH', './data/okala.db'),
  cachePath: required('CACHE_PATH', './data/cache.json'),

  sessionMaxAgeMs: parseInt(process.env.SESSION_MAX_AGE_MS || String(8 * 60 * 60 * 1000), 10), // 8h default

  businessTimezone: required('BUSINESS_TIMEZONE', 'Asia/Tehran'),

  // Section 6: daily auto-refresh time (24h "HH:MM" in businessTimezone)
  autoRefreshTime: required('AUTO_REFRESH_TIME', '11:00'),

  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};
