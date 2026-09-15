'use strict';

const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { hashPassword } = require('../auth/auth');

function initDb(dbPath, { adminEmail, adminInitialPassword }) {
  const db = new DatabaseSync(dbPath);
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

  // Seed the Admin account (Section 8/10) if it doesn't exist yet.
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
  if (!existing) {
    if (!adminInitialPassword) {
      adminInitialPassword = crypto.randomBytes(9).toString('base64url');
      // eslint-disable-next-line no-console
      console.log('='.repeat(70));
      console.log(`No ADMIN_INITIAL_PASSWORD set. Generated one-time Admin password:`);
      console.log(`  Email:    ${adminEmail}`);
      console.log(`  Password: ${adminInitialPassword}`);
      console.log('You will be forced to change this on first login. Save it now.');
      console.log('='.repeat(70));
    }
    const hash = hashPassword(adminInitialPassword);
    db.prepare(
      `INSERT INTO users (email, name, password_hash, role, status, must_change_password)
       VALUES (?, ?, ?, 'admin', 'active', 1)`
    ).run(adminEmail, 'Administrator', hash);
  }


  const bonusRows = [
    ['Tehran','Supermarket','NFC',2500000],['Tehran','Supermarket','Cancel',2500000],['Tehran','Supermarket','Return',1500000],['Tehran','Supermarket','Refund',3000000],['Tehran','Supermarket','Assortment',4000000],['Tehran','Supermarket','Deal',6000000],['Tehran','Supermarket','Availability',1500000],['Tehran','Supermarket','HyperDelay',1500000],['Tehran','Supermarket','Churn',2000000],
    ['Tehran','Other Service','NFC',2500000],['Tehran','Other Service','Cancel',3000000],['Tehran','Other Service','Return',2000000],['Tehran','Other Service','Refund',2000000],['Tehran','Other Service','Availability',2000000],['Tehran','Other Service','HyperDelay',2000000],['Tehran','Other Service','Churn',1500000],
    ['Other Cities','Other Service','NFC',3000000],['Other Cities','Other Service','Cancel',3000000],['Other Cities','Other Service','Return',1500000],['Other Cities','Other Service','Refund',2000000],['Other Cities','Other Service','Availability',1500000],['Other Cities','Other Service','HyperDelay',1000000],['Other Cities','Other Service','Churn',1000000],['Other Cities','Other Service','Acquisition',2000000],
    ['Other Cities','Supermarket','NFC',2500000],['Other Cities','Supermarket','Cancel',1500000],['Other Cities','Supermarket','Return',1000000],['Other Cities','Supermarket','Refund',2500000],['Other Cities','Supermarket','Assortment',3000000],['Other Cities','Supermarket','Acquisition',3000000],['Other Cities','Supermarket','Deal',6000000],['Other Cities','Supermarket','Availability',1500000],['Other Cities','Supermarket','HyperDelay',1000000],['Other Cities','Supermarket','Churn',2000000]
  ];
const count = db.prepare('SELECT COUNT(*) AS n FROM kpi_config').get().n;

if (!count) {
  const ins = db.prepare(
    `INSERT INTO kpi_config(
      city,
      provider,
      kpi,
      target,
      bonus_amount,
      effective_from,
      active
    ) VALUES (?, ?, ?, NULL, ?, ?, 1)`
  );

  db.exec('BEGIN TRANSACTION');

  try {
    for (const [city, provider, kpi, amount] of bonusRows) {
      ins.run(city, provider, kpi, amount, '2026-01-01');
    }

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
  return db;
}

module.exports = { initDb };
