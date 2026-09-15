'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getChurnWindow, calculateChurn } = require('../calculations/churn');

test('churn window for August = 17 July -> 16 August', () => {
  const w = getChurnWindow(2026, 8);
  assert.equal(w.start.getUTCFullYear(), 2026);
  assert.equal(w.start.getUTCMonth(), 6); // July = index 6
  assert.equal(w.start.getUTCDate(), 17);
  assert.equal(w.end.getUTCMonth(), 7); // August = index 7
  assert.equal(w.end.getUTCDate(), 16);
});

test('churn window handles January correctly (previous month = December of prior year)', () => {
  const w = getChurnWindow(2026, 1);
  assert.equal(w.start.getUTCFullYear(), 2025);
  assert.equal(w.start.getUTCMonth(), 11); // December
  assert.equal(w.start.getUTCDate(), 17);
  assert.equal(w.end.getUTCFullYear(), 2026);
  assert.equal(w.end.getUTCMonth(), 0); // January
  assert.equal(w.end.getUTCDate(), 16);
});

test('Rule: live after the 16th of selected month is excluded from denominator', () => {
  const vendors = [
    { vendorId: 'V1', liveDate: new Date(Date.UTC(2026, 7, 20)), churnDate: null }, // live Aug 20 (after 16th)
  ];
  const result = calculateChurn(vendors, 2026, 8);
  assert.equal(result.perVendor[0].countedAsLive, false);
  assert.equal(result.perVendor[0].reason, 'LIVE_AFTER_PERIOD_END');
});

test('Rule: churned outside the window does not count as churn but stays live in denominator', () => {
  const vendors = [
    {
      vendorId: 'V2',
      liveDate: new Date(Date.UTC(2026, 0, 1)),
      churnDate: new Date(Date.UTC(2026, 8, 1)), // churned Sept 1, outside the Jul17-Aug16 window
    },
  ];
  const result = calculateChurn(vendors, 2026, 8);
  assert.equal(result.perVendor[0].countedAsLive, true);
  assert.equal(result.perVendor[0].countedAsChurn, false);
  assert.equal(result.perVendor[0].reason, 'CHURNED_OUTSIDE_WINDOW');
});

test('Rule: churn inside the window counts', () => {
  const vendors = [
    {
      vendorId: 'V3',
      liveDate: new Date(Date.UTC(2026, 0, 1)),
      churnDate: new Date(Date.UTC(2026, 7, 5)), // Aug 5, inside window
    },
  ];
  const result = calculateChurn(vendors, 2026, 8);
  assert.equal(result.perVendor[0].countedAsLive, true);
  assert.equal(result.perVendor[0].countedAsChurn, true);
  assert.equal(result.perVendor[0].reason, 'CHURNED_IN_PERIOD');
});

test('Rule: churned before the window started is excluded from denominator entirely', () => {
  const vendors = [
    {
      vendorId: 'V4',
      liveDate: new Date(Date.UTC(2025, 0, 1)),
      churnDate: new Date(Date.UTC(2026, 5, 1)), // churned June 1, before Jul 17 window start
    },
  ];
  const result = calculateChurn(vendors, 2026, 8);
  assert.equal(result.perVendor[0].countedAsLive, false);
  assert.equal(result.perVendor[0].reason, 'CHURNED_BEFORE_PERIOD');
});

test('missing live date is flagged, not guessed', () => {
  const vendors = [{ vendorId: 'V5', liveDate: null, churnDate: null }];
  const result = calculateChurn(vendors, 2026, 8);
  assert.equal(result.perVendor[0].reason, 'MISSING_LIVE_DATE');
});

test('aggregate churn rate = churned / live-during-period', () => {
  const vendors = [
    { vendorId: 'A', liveDate: new Date(Date.UTC(2025, 0, 1)), churnDate: new Date(Date.UTC(2026, 7, 5)) }, // churn in window
    { vendorId: 'B', liveDate: new Date(Date.UTC(2025, 0, 1)), churnDate: null }, // still live
    { vendorId: 'C', liveDate: new Date(Date.UTC(2025, 0, 1)), churnDate: null }, // still live
    { vendorId: 'D', liveDate: new Date(Date.UTC(2026, 7, 20)), churnDate: null }, // live after 16th, excluded
  ];
  const result = calculateChurn(vendors, 2026, 8);
  assert.equal(result.liveDuringPeriod, 3);
  assert.equal(result.churnedInPeriod, 1);
  assert.ok(Math.abs(result.churnRate - (1 / 3)) < 1e-9);
});

test('no vendors live during period -> churnRate is null, not divide-by-zero garbage', () => {
  const result = calculateChurn([], 2026, 8);
  assert.equal(result.churnRate, null);
});
