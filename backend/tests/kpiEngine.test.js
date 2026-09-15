'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const kpi = require('../calculations/kpiEngine');

test('NFC boundaries (Section 52 example, target=1.0)', () => {
  const target = 1.0;
  assert.equal(kpi.scoreNFC(target * 0.59, target), 1, 'below lower boundary -> 100%');
  assert.equal(kpi.scoreNFC(target * 0.60, target), 1, 'exactly at lower boundary -> 100%');
  assert.equal(kpi.scoreNFC(target * 1.00, target), 0, 'exactly at upper boundary -> 0%');
  assert.equal(kpi.scoreNFC(target * 1.01, target), 0, 'above upper boundary -> 0%');
  // midpoint of the 60%-100% range
  const mid = kpi.scoreNFC(target * 0.80, target);
  assert.ok(Math.abs(mid - 0.5) < 1e-9, `midpoint should score 50%, got ${mid}`);
});

test('Cancel Vendor Side uses same 60-100 shape as NFC', () => {
  const target = 2.0;
  assert.equal(kpi.scoreCancelVendorSide(target * 0.5, target), 1);
  assert.equal(kpi.scoreCancelVendorSide(target * 1.2, target), 0);
});

test('Return Vendor Side uses 50-100 shape', () => {
  const target = 4.0;
  assert.equal(kpi.scoreReturnVendorSide(target * 0.49, target), 1);
  assert.equal(kpi.scoreReturnVendorSide(target * 0.50, target), 1);
  assert.equal(kpi.scoreReturnVendorSide(target * 1.00, target), 0);
  const mid = kpi.scoreReturnVendorSide(target * 0.75, target); // midpoint of 50-100
  assert.ok(Math.abs(mid - 0.5) < 1e-9);
});

test('Refund Vendor Side uses 70-100 shape', () => {
  const target = 3.0;
  assert.equal(kpi.scoreRefundVendorSide(target * 0.69, target), 1);
  assert.equal(kpi.scoreRefundVendorSide(target * 1.0, target), 0);
  const mid = kpi.scoreRefundVendorSide(target * 0.85, target); // midpoint of 70-100
  assert.ok(Math.abs(mid - 0.5) < 1e-9);
});

test('Hyper Delay uses 40-80 shape', () => {
  const target = 10.0;
  assert.equal(kpi.scoreHyperDelay(target * 0.39, target), 1);
  assert.equal(kpi.scoreHyperDelay(target * 0.80, target), 0);
  const mid = kpi.scoreHyperDelay(target * 0.60, target); // midpoint of 40-80
  assert.ok(Math.abs(mid - 0.5) < 1e-9);
});

test('Assortment Fluctuation boundaries (Section 52)', () => {
  assert.equal(kpi.scoreAssortmentFluctuation(-1.5), 0, '< -1 -> 0%');
  assert.equal(kpi.scoreAssortmentFluctuation(-1), 0, '= -1 -> 0%');
  assert.equal(kpi.scoreAssortmentFluctuation(3), 1, '= 3 -> 100%');
  assert.equal(kpi.scoreAssortmentFluctuation(3.5), 1, '> 3 -> 100%');
  const mid = kpi.scoreAssortmentFluctuation(1); // midpoint of -1..3
  assert.ok(Math.abs(mid - 0.5) < 1e-9);
});

test('Assortment Fluctuation calculation formula', () => {
  // (current - previous) / current
  const result = kpi.calcAssortmentFluctuation(200, 150);
  assert.ok(Math.abs(result - 0.25) < 1e-9);
  assert.equal(kpi.calcAssortmentFluctuation(0, 100), null, 'zero current month must not divide by zero');
});

test('Deal — both stages must contribute, never short-circuit to 100%', () => {
  // Section 33 worked example: Barcode=100%, Discount=50% -> Final=75%
  assert.equal(kpi.scoreDealBarcode(400), 1.00);
  assert.equal(kpi.scoreDealDiscount(6), 0.50);
  assert.ok(Math.abs(kpi.scoreDeal(400, 6) - 0.75) < 1e-9);

  // Barcode maxed but discount at 0 must NOT produce 100% deal score
  assert.ok(Math.abs(kpi.scoreDeal(400, 2) - 0.5) < 1e-9);
});

test('Deal barcode step boundaries', () => {
  assert.equal(kpi.scoreDealBarcode(50), 0.00);
  assert.equal(kpi.scoreDealBarcode(100), 0.00);
  assert.equal(kpi.scoreDealBarcode(101), 0.25);
  assert.equal(kpi.scoreDealBarcode(150), 0.25);
  assert.equal(kpi.scoreDealBarcode(151), 0.50);
  assert.equal(kpi.scoreDealBarcode(250), 0.50);
  assert.equal(kpi.scoreDealBarcode(251), 0.75);
  assert.equal(kpi.scoreDealBarcode(350), 0.75);
  assert.equal(kpi.scoreDealBarcode(351), 1.00);
});

test('Deal discount step boundaries', () => {
  assert.equal(kpi.scoreDealDiscount(3), 0.00);
  assert.equal(kpi.scoreDealDiscount(4.0), 0.00);
  assert.equal(kpi.scoreDealDiscount(4.5), 0.25);
  assert.equal(kpi.scoreDealDiscount(5.0), 0.25);
  assert.equal(kpi.scoreDealDiscount(7.0), 0.50);
  assert.equal(kpi.scoreDealDiscount(8.0), 0.50);
  assert.equal(kpi.scoreDealDiscount(9.0), 0.75);
  assert.equal(kpi.scoreDealDiscount(10.0), 0.75);
  assert.equal(kpi.scoreDealDiscount(10.5), 1.00);
});

test('Availability hard threshold, Supermarket vs Other', () => {
  assert.equal(kpi.scoreAvailability(92.9, 'Supermarket'), 0);
  assert.equal(kpi.scoreAvailability(93.0, 'Supermarket'), 1);
  assert.equal(kpi.scoreAvailability(89.9, 'Other'), 0);
  assert.equal(kpi.scoreAvailability(90.0, 'Other'), 1);
});

test('bonusAmount multiplies score by configured amount', () => {
  assert.equal(kpi.bonusAmount(0.75, 6000000), 4500000);
  assert.equal(kpi.bonusAmount(1.4, 1000000), 1000000, 'score is clamped to 1 max');
  assert.equal(kpi.bonusAmount(-0.2, 1000000), 0, 'score is clamped to 0 min');
});
