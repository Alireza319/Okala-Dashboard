# ARCHITECTURE.md

## Layers

```
Google Sheets (Apps Script Web App)
        |
GoogleSheetsAdapter  (implements DataSourceAdapter)
        |
Normalization layer   (backend/data/normalize.js — header-based mapping,
                        throws DataSchemaError on missing required fields,
                        never guesses)
        |
Calculation engine     (backend/calculations/*.js — pure, unit-tested
                        functions: kpiEngine, churn, bonusEngine)
        |
Refresh pipeline        (backend/services/refresh.js — atomic:
                        fetch -> validate -> normalize -> calculate -> swap)
        |
CacheStore              (in-memory snapshot; swap for Redis if you run
                        more than one backend instance)
        |
Express API             (backend/routes/*.js — auth, admin, dashboard;
                        every route enforces authorization server-side)
        |
Frontend                (frontend/ — static HTML/CSS/JS, talks only to
                        the Express API, never to Google Sheets directly)
```

## Why it's built this way

- **DataSourceAdapter is an interface, not a convention.** `GoogleSheetsAdapter`
  is the only thing that knows about Apps Script URLs. When you eventually
  get direct data-center APIs, you write `ApiDataAdapter implements
  DataSourceAdapter` and change one line in `backend/server.js`. Nothing
  in the calculation engine, auth, or frontend needs to change.

- **Calculation functions are pure.** Every function in `kpiEngine.js`,
  `churn.js`, and `bonusEngine.js` takes plain data in and returns plain
  data out — no database calls, no HTTP calls inside them. That's what
  makes `node --test backend/tests/*.test.js` meaningful: the tests prove
  the financial formulas are correct in isolation, independent of whether
  the data source or database is working.

- **The cache is a hard boundary.** Dashboard routes never call the Google
  Sheets adapter directly (Section 5) — they only ever read
  `cacheStore.get()`. This keeps every user's page load fast regardless of
  spreadsheet size, and means a broken/slow Google Sheets call can't hang
  a live user request; only the scheduled/manual refresh talks to Sheets.

- **Refresh is atomic.** `runRefresh()` builds an entirely new snapshot
  object and only calls `cacheStore.set()` once it succeeds. If anything
  throws first, the old snapshot is untouched — the dashboard never shows
  half-updated data (Section 71).

- **Authorization lives in middleware, not components.** `scopeToOwnAgent`
  in `backend/auth/middleware.js` is the single place that decides which
  agent's data a request is allowed to see, and it derives that from the
  session record in the database — never from a query parameter the
  client sent. This is what makes `/api/dashboard/vendors/:id?agent=other`
  fail safely regardless of what the frontend does or doesn't check.

## What's implemented vs. scaffolded

**Fully implemented and tested:**
- KPI scoring formulas (NFC, Cancel, Return, Refund, Hyper Delay, Assortment,
  Deal, Availability) — `backend/calculations/kpiEngine.js`, 21 passing tests.
- Churn window + business rules — `backend/calculations/churn.js`, tested
  against every edge case in Section 52.
- Authentication (scrypt password hashing, HttpOnly session cookies, rate
  limiting), role-based authorization, agent data isolation — verified by
  live smoke test (see chat transcript / README "Verifying it works").
- Atomic refresh pipeline, admin user management, KPI config CRUD, activity
  and login logging, structured data-schema errors.

**Scaffolded, needs your input to finish:**
- The exact Deal/Refund/Availability/Acquisition source columns — see
  "Known open questions" in `DATA_MAPPING.md`. The engine will correctly
  report `MISSING_INPUT`/`DATA_ERROR` for these until you confirm them; it
  will not silently produce wrong numbers.
- Your Apps Script Web App needs the three actions documented in
  `docs/apps-script-example.gs` — your current deployment (per Section 72)
  likely doesn't expose them yet.
- Charts, maps, and drill-down UI: the frontend ships a working login,
  session, role-based nav, and a real vendor table wired to the live API —
  the visualization layer (Leaflet map, Chart.js trend/ranking/heatmap
  views) is not built out in this pass. The API and data model are shaped
  to support them (`GET /api/dashboard/overview` already returns
  normalized vendor records with lat/lng, KPI fields, etc.) so adding them
  is wiring, not architecture.
- Production deployment (Vercel/Cloud Run/Postgres/Redis) is documented in
  README but not provisioned — I have no ability to create cloud accounts
  or deploy from this sandbox.

## Scaling beyond a single instance

Two pieces are currently single-instance-only by design (documented inline
so nobody trips over it later):
1. `RateLimiter` in `auth/auth.js` is in-memory.
2. `CacheStore` in `services/refresh.js` is in-memory.

If you deploy multiple backend instances behind a load balancer, move both
to Redis before doing so, or you'll get inconsistent rate limiting and
stale caches on different instances.
