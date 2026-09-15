/**
 * KPI Bonus Scoring Engine
 * ------------------------
 * Every function here is a PURE function: (actual, target, ...params) => score (0..1)
 * No side effects, no I/O, fully unit-testable. This module must never be edited to
 * "fudge" a result — if a formula needs to change, it changes here, once, deliberately,
 * and the corresponding test in tests/calculations.test.js must be updated to match.
 *
 * All scoring functions return a number in [0, 1] representing the Bonus Score.
 * Multiply by the configured KPI bonus amount to get the Bonus Amount.
 */

'use strict';

/** Clamp a number into [0, 1]. */
function clamp01(x) {
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

/**
 * Generic "lower-anchored" linear scoring shape used by NFC, Cancel, Return,
 * Refund, Hyper Delay:
 *
 *   actual < target * lowerPct   -> score = 1
 *   actual > target * upperPct   -> score = 0
 *   otherwise                    -> linear interpolation between the two
 *
 * lowerPct is always < upperPct (e.g. 0.60 -> 1.00 for NFC).
 */
function lowerAnchoredScore(actual, target, lowerPct, upperPct) {
  if (target === 0 || target == null || actual == null) return 0;
  const lowerBound = target * lowerPct;
  const upperBound = target * upperPct;

  if (actual < lowerBound) return 1;
  if (actual > upperBound) return 0;

  return clamp01((upperBound - actual) / (upperBound - lowerBound));
}

/** Section 28 — NFC: scoring range 60% -> 100% of target */
function scoreNFC(actual, target) {
  return lowerAnchoredScore(actual, target, 0.60, 1.00);
}

/** Section 29 — Cancel Vendor Side: same shape as NFC, 60% -> 100% */
function scoreCancelVendorSide(actual, target) {
  return lowerAnchoredScore(actual, target, 0.60, 1.00);
}

/** Section 30 — Return Vendor Side: scoring range 50% -> 100% */
function scoreReturnVendorSide(actual, target) {
  return lowerAnchoredScore(actual, target, 0.50, 1.00);
}

/** Section 31 — Refund Vendor Side (Complaint): scoring range 70% -> 100% */
function scoreRefundVendorSide(actual, target) {
  return lowerAnchoredScore(actual, target, 0.70, 1.00);
}

/** Section 34 — Hyper Delay: scoring range 40% -> 80% */
function scoreHyperDelay(actual, target) {
  return lowerAnchoredScore(actual, target, 0.40, 0.80);
}

/**
 * Section 32 — Assortment Fluctuation
 * result = (currentMonthAssortment - previousMonthAssortment) / currentMonthAssortment
 *   result < -1   -> 0
 *   result > 3    -> 1
 *   otherwise     -> linear interpolation between -1 and 3
 *
 * Boundaries are parameters with spec defaults, not scattered magic numbers,
 * so Admin can override them later (Section 32).
 */
function calcAssortmentFluctuation(currentMonthAssortment, previousMonthAssortment) {
  if (!currentMonthAssortment) return null; // caller must surface a data error, never guess
  return (currentMonthAssortment - previousMonthAssortment) / currentMonthAssortment;
}

function scoreAssortmentFluctuation(result, lowerBound = -1, upperBound = 3) {
  if (result == null || Number.isNaN(result)) return 0;
  if (result < lowerBound) return 0;
  if (result > upperBound) return 1;
  return clamp01((result - lowerBound) / (upperBound - lowerBound));
}

/**
 * Section 33 — Deal Okala Side
 * Two independent stages, each scored on its own step function, then averaged.
 * NEVER short-circuit to 100% when only one stage is maxed — both must contribute.
 */
function scoreDealBarcode(barcodeCount) {
  if (barcodeCount == null) return 0;
  if (barcodeCount <= 100) return 0.00;
  if (barcodeCount <= 150) return 0.25;
  if (barcodeCount <= 250) return 0.50;
  if (barcodeCount <= 350) return 0.75;
  return 1.00; // > 350
}

function scoreDealDiscount(avgOfAvgDiscountPct) {
  // avgOfAvgDiscountPct expressed as a percent number, e.g. 8.5 for 8.5%
  if (avgOfAvgDiscountPct == null) return 0;
  if (avgOfAvgDiscountPct <= 4.0) return 0.00;
  if (avgOfAvgDiscountPct <= 5.0) return 0.25;
  if (avgOfAvgDiscountPct <= 8.0) return 0.50;
  if (avgOfAvgDiscountPct <= 10.0) return 0.75;
  return 1.00; // > 10.1% per spec
}

function scoreDeal(barcodeCount, avgOfAvgDiscountPct) {
  const barcodeScore = scoreDealBarcode(barcodeCount);
  const discountScore = scoreDealDiscount(avgOfAvgDiscountPct);
  return (barcodeScore + discountScore) / 2;
}

/**
 * Section 35 — Availability. Hard threshold, not linear.
 */
function scoreAvailability(actualPct, segment, thresholds = { supermarket: 93, other: 90 }) {
  if (actualPct == null) return 0;
  const threshold = segment === 'Supermarket' ? thresholds.supermarket : thresholds.other;
  return actualPct >= threshold ? 1 : 0;
}

/** Applies to every KPI once you have a score in [0,1]. */
function bonusAmount(score, kpiBonusAmount) {
  return clamp01(score) * kpiBonusAmount;
}

module.exports = {
  clamp01,
  lowerAnchoredScore,
  scoreNFC,
  scoreCancelVendorSide,
  scoreReturnVendorSide,
  scoreRefundVendorSide,
  scoreHyperDelay,
  calcAssortmentFluctuation,
  scoreAssortmentFluctuation,
  scoreDealBarcode,
  scoreDealDiscount,
  scoreDeal,
  scoreAvailability,
  bonusAmount,
};
