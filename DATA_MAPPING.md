# DATA_MAPPING.md

## ⚠️ Status: DRAFT — not yet validated against your live spreadsheet

I could not inspect your actual Google Sheets from this environment (this
sandbox's network access is restricted to package registries — it cannot
reach `script.google.com` or `docs.google.com`). Section 4/75 of the brief
requires this mapping to be validated against the real sheet *before* the
calculation engine depends on it. Everything below is built from:

1. Column names you described in the current request (Sections 4, 23, 33).
2. Column names from your previously-confirmed sheet in an earlier session
   (`https://docs.google.com/spreadsheets/d/1UizX9twAgQ3tosDkv0QsVWjF0aLZMHH3cQC97ts28Ww`,
   tab `Sheet1`), which used: `Week, Vendor, Gross Order, Delivered Orders,
   %OSR, %Cancelled, %Returned, %Delay (>10 mins), Order Sellabale Price,
   Assortment, Grade NFC, Grade Cancel, Agent, ID, Live?, lat & long`.

**Before trusting any calculated number, run the schema inspector:**

```bash
node scripts/inspect-schema.js
```

(See `scripts/inspect-schema.js` — calls `listSchemas()` on your configured
adapter and prints every sheet's actual headers, so you can diff them against
this table and fix `backend/data/normalize.js` where they disagree.)

## Field mapping table

| Dashboard Field   | Source Sheet         | Source Column (as currently believed) | Transform                          | Type   | Required |
|--------------------|----------------------|----------------------------------------|-------------------------------------|--------|----------|
| vendorId            | Sales & cub / others  | `ID`                                    | —                                    | string | Yes |
| vendorName          | Sales & cub            | `Vendor`                                | —                                    | string | Yes |
| agent               | Sales & cub            | `Agent`                                 | —                                    | string | Yes |
| city                | (not yet confirmed)    | `City`                                  | —                                    | string | Yes |
| provider            | (not yet confirmed)    | `Provider`                              | —                                    | string | Yes |
| status / live       | Sales & cub            | `Live?`                                 | —                                    | string | Yes |
| liveDate            | (not yet confirmed)    | `Live Date`                             | parse as date (sheet serial or ISO) | date   | Yes for churn calc |
| churnDate           | (not yet confirmed)    | `Churn Date`                            | parse as date                        | date   | For churned vendors |
| latitude/longitude  | Sales & cub             | column T (per Section 23)               | split combined "lat & long" if needed| number | For map |
| latitude/longitude  | Other (sales & cub)     | columns N and AE (per Section 23)       | —                                     | number | For map |
| grossOrder          | Sales & cub             | `Gross Order`                           | —                                     | number | For KPI denominators |
| deliveredOrders     | Sales & cub             | `Delivered Orders`                      | —                                     | number | |
| osrPct              | Sales & cub             | `%OSR`                                  | —                                     | number | |
| cancelledPct        | Sales & cub             | `%Cancelled`                            | —                                     | number | Cancel KPI actual |
| returnedPct         | Sales & cub             | `%Returned`                             | —                                     | number | Return KPI actual |
| delayPct            | Sales & cub             | `%Delay (>10 mins)`                     | —                                     | number | Hyper Delay actual |
| assortment          | Assortment sheet        | `Assortment`                            | current vs. previous month diff       | number | Assortment KPI |
| nfcCount            | Sales & cub             | `Grade NFC` (raw count, per earlier session) | NFC% = SUM(count)/SUM(Gross Order) | number | NFC KPI |
| barcodeCount         | (not yet confirmed)     | Deal sheet — barcode count column       | —                                     | number | Deal KPI stage 1 |
| avgOfAvgDiscountPct  | (not yet confirmed)     | Deal sheet — avg discount column        | —                                     | number | Deal KPI stage 2 |
| refundPct            | (not yet confirmed)     | Compensation / Ops Performance sheet    | —                                     | number | Refund KPI |
| availabilityPct      | Availability sheet      | (not yet confirmed)                     | —                                     | number | Availability KPI |
| acquisitionCount     | (not yet confirmed)     | (not yet confirmed — Section 37: do not guess, show config error if missing) | — | number | Acquisition KPI, Other Cities only |

## Known open questions (must be resolved before Deal, Refund, Availability,
## and Acquisition KPIs can run correctly)

- Which exact sheet + column holds **Barcode count** and **Average of
  Average Discount** for the Deal KPI (Section 33)?
- Which sheet + column holds **Refund Vendor Side (Complaint)** actuals
  (Section 31)?
- Which sheet + column holds **Availability %** (Section 35) — is it per
  vendor per month, or an aggregate?
- Is there an **Acquisition** source field at all for Other Cities vendors
  (Section 37), or does it need to be derived from live-date counts?
- Confirm **City** and **Provider** columns exist as their own fields
  somewhere, or whether they must be derived (e.g. Provider inferred from
  which sheet a vendor appears in).

Until these are confirmed, `bonusEngine.js`'s `evaluateKPI()` for `Deal`,
`Refund`, `Availability`, and `Acquisition` will receive `undefined` inputs
from the normalization layer and correctly report a `MISSING_INPUT` /
`DATA_ERROR` result rather than a fabricated number — this is intentional
per Section 53 ("do not guess"), not a bug.
