# BUSINESS_LOGIC.md

Every KPI below follows the same shape: an **Actual** value is compared to a
**Target**, and the distance between them is converted into a **Bonus
Score** (0–100%), which is then multiplied by that KPI's configured **Bonus
Amount** to get the **Earned Bonus**. Targets and bonus amounts are
configured by Admin (not hard-coded) and can change month to month.

---

## NFC
- **Input:** NFC rate (actual)
- **Target:** configured per City/Provider
- **Scoring range:** 60%–100% of target
- Below 60% of target → 100% bonus score. Above 100% of target → 0%.
  Between the two, score falls in a straight line.
- **Example:** Target = 2.00%, Actual = 1.62% → score is between 60–100%
  of target, computed proportionally; multiplied by the configured bonus
  amount (e.g. 2,500,000 for Tehran Supermarket) for the earned bonus.
- **Edge cases:** exactly at 60% of target scores 100%; exactly at 100% of
  target scores 0%.

## Cancel Vendor Side
Same shape as NFC (60%–100% scoring range), different bonus amount.

## Return Vendor Side
Same shape, but the scoring range is 50%–100% of target (more lenient at
the low end than NFC/Cancel).

## Refund Vendor Side (Complaint)
Same shape, scoring range is 70%–100% of target.

## Hyper Delay
Same shape, scoring range is 40%–80% of target — the narrowest band, so
small changes in actual delay swing the bonus score more.

## Assortment Fluctuation
- **Formula:** `(Current Month Assortment − Previous Month Assortment) ÷
  Current Month Assortment`
- **Scoring:** below −1 → 0%. Above +3 → 100%. Between, proportional.
- **Edge case:** if Current Month Assortment is zero, the formula divides
  by zero — the system reports a data error instead of guessing.

## Deal (Okala Side)
Two independent stages, averaged — **not** "either one hits 100% = full
bonus":
1. **Barcode count**, scored in bands (0–100 → 0%, 100–150 → 25%, 150–250 →
   50%, 250–350 → 75%, above 350 → 100%).
2. **Average of Average Discount**, scored in bands (up to 4% → 0%, 4–5% →
   25%, 5–8% → 50%, 8–10% → 75%, above 10% → 100%).
- **Final score** = (Barcode Score + Discount Score) ÷ 2.
- **Example:** Barcode Score 100%, Discount Score 50% → Final Deal Score
  75%, times the 6,000,000 bonus amount = 4,500,000 earned.

## Hyper Delay, Availability — see above/below.

## Availability
- Hard threshold, not a sliding scale: Supermarket needs ≥93% to earn
  100% of the Availability bonus (below that, 0%). Other Service needs
  ≥90%.

## Churn
- **Measurement window:** the 17th of the previous month through the 16th
  of the selected month (e.g. August = 17 July → 16 August).
- **Denominator:** markets that were live during that window.
  - A market that went live *after* the 16th of the selected month is
    excluded entirely (it's not "during the period" yet).
  - A market that churned *before* the window started doesn't count either
    (it wasn't live during the period).
- **Numerator:** markets that churned *inside* the window specifically. A
  market that churned outside the window (too early or too late) is not
  counted as churn for this period, even though it still counts toward the
  denominator if it was live during the window.
- **Rate** = churned-in-window ÷ live-during-window, then scored the same
  60–100% way as NFC/Cancel against the configured Churn target.

## Acquisition
Only applies to Other Cities vendors (both Supermarket and Other Service).
Scored the same 60–100% way against a configured target. If the source
data doesn't have enough information to calculate this, the system reports
a configuration error rather than guessing — see "Known open questions" in
DATA_MAPPING.md.

## Bonus Summary
Each Agent's dashboard totals every KPI's Earned Bonus and Maximum Possible
Bonus, and shows the overall Achievement % — this is a simple sum, not a
separate formula.

## Transparency (Section 40)
Clicking any KPI bonus is meant to show: the raw Actual value, the Target,
the Lower/Upper scoring boundaries actually used, the resulting Bonus
Score, the KPI's Maximum Bonus, and the Earned Bonus — exactly the fields
`bonusEngine.js`'s `evaluateKPI()` returns, so the UI never has to
recompute or approximate what the backend already calculated.
