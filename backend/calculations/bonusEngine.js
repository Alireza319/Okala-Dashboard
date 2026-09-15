/**
 * Bonus Calculation Engine (Sections 27, 39, 40)
 * ------------------------------------------------
 * Ties kpiEngine's pure scoring functions to a vendor/agent's actual metrics
 * and Admin-configured targets/bonus amounts, and produces a fully
 * explainable result object for every KPI — never just a number.
 *
 * config shape (one row per City+Provider+KPI, see Admin > KPI Configuration,
 * Section 25/26/42):
 *   {
 *     kpi: 'NFC',
 *     city: 'Tehran', provider: 'Supermarket',
 *     target: 2.00,
 *     bonusAmount: 2500000,
 *     lowerBoundaryPct: 0.60,   // optional override, else KPI default
 *     upperBoundaryPct: 1.00,   // optional override, else KPI default
 *     effectiveFrom: '2026-01-01', effectiveTo: null, active: true
 *   }
 *
 * This module deliberately does NOT fetch config itself — the caller passes
 * in the already-resolved config for the vendor's City+Provider+period, so
 * this stays a pure, unit-testable function with no DB/network dependency.
 */

'use strict';

const kpi = require('./kpiEngine');
const { calculateChurn } = require('./churn');

/**
 * Build one explainable KPI result.
 * @param {string} kpiName
 * @param {number} actual
 * @param {object} cfg  { target, bonusAmount, lowerBoundaryPct?, upperBoundaryPct? }
 * @param {object} extra  kpi-specific extra params (segment, barcodeCount, etc.)
 */
function evaluateKPI(kpiName, actual, cfg, extra = {}) {
  if (cfg == null || cfg.target == null || cfg.bonusAmount == null) {
    return {
      kpi: kpiName,
      error: 'MISSING_CONFIGURATION',
      message: `No active target/bonus configuration found for KPI "${kpiName}" for this City/Provider/period.`,
    };
  }

  let score;
  let lowerBound = null;
  let upperBound = null;

  switch (kpiName) {
    case 'NFC':
      lowerBound = cfg.target * (cfg.lowerBoundaryPct ?? 0.60);
      upperBound = cfg.target * (cfg.upperBoundaryPct ?? 1.00);
      score = kpi.scoreNFC(actual, cfg.target);
      break;
    case 'Cancel':
      lowerBound = cfg.target * (cfg.lowerBoundaryPct ?? 0.60);
      upperBound = cfg.target * (cfg.upperBoundaryPct ?? 1.00);
      score = kpi.scoreCancelVendorSide(actual, cfg.target);
      break;
    case 'Return':
      lowerBound = cfg.target * (cfg.lowerBoundaryPct ?? 0.50);
      upperBound = cfg.target * (cfg.upperBoundaryPct ?? 1.00);
      score = kpi.scoreReturnVendorSide(actual, cfg.target);
      break;
    case 'Refund':
      lowerBound = cfg.target * (cfg.lowerBoundaryPct ?? 0.70);
      upperBound = cfg.target * (cfg.upperBoundaryPct ?? 1.00);
      score = kpi.scoreRefundVendorSide(actual, cfg.target);
      break;
    case 'HyperDelay':
      lowerBound = cfg.target * (cfg.lowerBoundaryPct ?? 0.40);
      upperBound = cfg.target * (cfg.upperBoundaryPct ?? 0.80);
      score = kpi.scoreHyperDelay(actual, cfg.target);
      break;
    case 'Assortment': {
      const result = kpi.calcAssortmentFluctuation(extra.currentMonthAssortment, extra.previousMonthAssortment);
      if (result === null) {
        return { kpi: kpiName, error: 'DATA_ERROR', message: 'Current month assortment is zero or missing — cannot compute fluctuation.' };
      }
      lowerBound = cfg.lowerBoundaryPct ?? -1;
      upperBound = cfg.upperBoundaryPct ?? 3;
      score = kpi.scoreAssortmentFluctuation(result, lowerBound, upperBound);
      actual = result; // report the computed fluctuation ratio as "actual"
      break;
    }
    case 'Deal':
      score = kpi.scoreDeal(extra.barcodeCount, extra.avgOfAvgDiscountPct);
      break;
    case 'Availability':
      lowerBound = cfg.target;
      score = kpi.scoreAvailability(actual, extra.segment, cfg.thresholds);
      break;
    case 'Churn': {
      if (!extra.vendors || extra.selectedYear == null || extra.selectedMonth == null) {
        return { kpi: kpiName, error: 'MISSING_INPUT', message: 'Churn requires vendors[], selectedYear, selectedMonth.' };
      }
      const churnResult = calculateChurn(extra.vendors, extra.selectedYear, extra.selectedMonth);
      if (churnResult.churnRate === null) {
        return { kpi: kpiName, error: 'DATA_ERROR', message: 'No vendors were live during the churn measurement period.' };
      }
      actual = churnResult.churnRate;
      lowerBound = cfg.target * (cfg.lowerBoundaryPct ?? 0.60);
      upperBound = cfg.target * (cfg.upperBoundaryPct ?? 1.00);
      score = kpi.lowerAnchoredScore(actual, cfg.target, cfg.lowerBoundaryPct ?? 0.60, cfg.upperBoundaryPct ?? 1.00);
      break;
    }
    case 'Acquisition':
      if (extra.actualCount == null || cfg.target == null) {
        return { kpi: kpiName, error: 'MISSING_INPUT', message: 'Acquisition requires an actual count and a configured target.' };
      }
      lowerBound = cfg.target * (cfg.lowerBoundaryPct ?? 0.60);
      upperBound = cfg.target * (cfg.upperBoundaryPct ?? 1.00);
      score = kpi.lowerAnchoredScore(actual, cfg.target, cfg.lowerBoundaryPct ?? 0.60, cfg.upperBoundaryPct ?? 1.00);
      break;
    default:
      return { kpi: kpiName, error: 'UNKNOWN_KPI', message: `No scoring rule implemented for "${kpiName}".` };
  }

  const earnedBonus = kpi.bonusAmount(score, cfg.bonusAmount);

  return {
    kpi: kpiName,
    actual,
    target: cfg.target,
    lowerBoundary: lowerBound,
    upperBoundary: upperBound,
    bonusScore: score,
    maxBonus: cfg.bonusAmount,
    earnedBonus,
  };
}

/**
 * Evaluate a full set of KPIs for one agent/vendor and produce a summary
 * (Section 39). `kpiInputs` maps kpiName -> { actual, extra }.
 * `configByKpi` maps kpiName -> config row.
 */
function evaluateBonusSummary(kpiInputs, configByKpi) {
  const results = {};
  let totalEarned = 0;
  let totalMax = 0;
  const errors = [];

  for (const [kpiName, input] of Object.entries(kpiInputs)) {
    const cfg = configByKpi[kpiName];
    const result = evaluateKPI(kpiName, input.actual, cfg, input.extra || {});
    results[kpiName] = result;
    if (result.error) {
      errors.push({ kpi: kpiName, error: result.error, message: result.message });
    } else {
      totalEarned += result.earnedBonus;
      totalMax += result.maxBonus;
    }
  }

  return {
    perKPI: results,
    totalEarned,
    totalMax,
    achievementPct: totalMax === 0 ? null : totalEarned / totalMax,
    errors,
  };
}

module.exports = { evaluateKPI, evaluateBonusSummary };
