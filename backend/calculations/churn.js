/**
 * Churn Calculation (Section 24)
 * -------------------------------
 * Churn is measured over a fixed window: the 17th of the month BEFORE the
 * selected month, through the 16th of the selected month (inclusive).
 *
 *   Selected month = August  ->  window = 17 July 00:00 -> 16 August 23:59:59
 *
 * Business rules implemented exactly as specified:
 *   Rule 1: a market that went live AFTER the 16th of the selected month is
 *           excluded from the denominator entirely (it wasn't "live during
 *           the period" in a way that counts).
 *   Rule 2: a market live during the period but churned OUTSIDE the window
 *           is not counted as churn for this period.
 *   Rule 3: a market that churned outside 17th->16th is not counted.
 *   Rule 4: churnRate = qualifyingChurnedCount / liveDuringPeriodCount
 *
 * All dates are handled as calendar dates in the configured business
 * timezone (default Asia/Tehran) — pass in already-normalized Date objects
 * or ISO strings; this module does not itself do timezone conversion, so the
 * normalization layer (backend/data/normalize.js) is responsible for
 * converting raw sheet values into correct local calendar dates BEFORE they
 * reach this function. Getting that wrong silently would corrupt every
 * bonus payout, so normalize.js must fail loudly on unparseable dates
 * rather than guess.
 */

'use strict';

/**
 * Build the churn measurement window for a given selected month/year.
 * @param {number} selectedYear e.g. 2026
 * @param {number} selectedMonth 1-12, the SELECTED month (e.g. 8 for August)
 * @returns {{ start: Date, end: Date }} start = 17th of previous month 00:00:00,
 *          end = 16th of selected month 23:59:59.999
 */
function getChurnWindow(selectedYear, selectedMonth) {
  if (selectedMonth < 1 || selectedMonth > 12) {
    throw new Error(`Invalid month: ${selectedMonth}`);
  }
  // JS Date months are 0-indexed
  const prevMonthDate = new Date(Date.UTC(selectedYear, selectedMonth - 2, 17, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(selectedYear, selectedMonth - 1, 16, 23, 59, 59, 999));
  return { start: prevMonthDate, end: endDate };
}

function inWindow(date, window) {
  if (!date) return false;
  const t = date.getTime();
  return t >= window.start.getTime() && t <= window.end.getTime();
}

/**
 * A vendor record must provide:
 *   { vendorId, liveDate: Date|null, churnDate: Date|null }
 * liveDate/churnDate must already be parsed Date objects, or null if unknown.
 *
 * Returns per-vendor classification plus the aggregate churn rate, so the
 * caller (and the drill-down UI) can show exactly which vendors counted.
 */
function calculateChurn(vendors, selectedYear, selectedMonth) {
  const window = getChurnWindow(selectedYear, selectedMonth);
  const cutoff16th = window.end; // "live after the 16th" boundary

  const results = vendors.map((v) => {
    const { vendorId, liveDate, churnDate } = v;

    if (!liveDate) {
      return { vendorId, countedAsLive: false, countedAsChurn: false, reason: 'MISSING_LIVE_DATE' };
    }

    // Rule 1: went live after the 16th of the selected month -> excluded entirely
    if (liveDate.getTime() > cutoff16th.getTime()) {
      return { vendorId, countedAsLive: false, countedAsChurn: false, reason: 'LIVE_AFTER_PERIOD_END' };
    }

    // Vendor was live at some point at/before the period end -> counts toward denominator,
    // UNLESS it churned before the window even started (i.e. it wasn't live during the period).
    if (churnDate && churnDate.getTime() < window.start.getTime()) {
      return { vendorId, countedAsLive: false, countedAsChurn: false, reason: 'CHURNED_BEFORE_PERIOD' };
    }

    const countedAsLive = true;

    // Rule 2 & 3: only count churn if the churn date falls strictly inside the window
    const countedAsChurn = !!churnDate && inWindow(churnDate, window);
    const reason = countedAsChurn
      ? 'CHURNED_IN_PERIOD'
      : (churnDate ? 'CHURNED_OUTSIDE_WINDOW' : 'STILL_LIVE');

    return { vendorId, countedAsLive, countedAsChurn, reason };
  });

  const liveDuringPeriod = results.filter((r) => r.countedAsLive).length;
  const churnedInPeriod = results.filter((r) => r.countedAsChurn).length;

  return {
    window,
    liveDuringPeriod,
    churnedInPeriod,
    churnRate: liveDuringPeriod === 0 ? null : churnedInPeriod / liveDuringPeriod,
    perVendor: results,
  };
}

module.exports = { getChurnWindow, calculateChurn };
