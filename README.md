# OKALA Corner Performance & Bonus Management Dashboard

A real, running backend + frontend, not a mockup. Read `ARCHITECTURE.md`
first for what's fully implemented vs. what's scaffolded and needs your
input (short version: the auth system, database, calculation engine, and
authorization are complete and tested; the exact source-sheet columns for
Deal/Refund/Availability/Acquisition and the visualization layer — maps,
charts — still need to be finished against your real data).

## 1. Install dependencies

```bash
npm install
```

No native compilation, no Docker required — the database uses Node's
built-in `node:sqlite` (Node ≥22.5 required; check with `node --version`).

## 2. Configure environment variables

```bash
cp .env.example .env
```

Then edit `.env`. At minimum you need `GOOGLE_SHEETS_ENDPOINT`.

## 3. Configure Google Sheets / the Apps Script endpoint

Your current Apps Script Web App likely doesn't yet expose the JSON
actions this backend needs (`ping`, `listSheets`, `getSheet`). Open your
Apps Script project and replace/extend it with the example in
`docs/apps-script-example.gs`, then redeploy the Web App and put its
`/exec` URL into `GOOGLE_SHEETS_ENDPOINT` in `.env`.

**Do this before anything else — Phase 1 of the build order (Section 74)
is inspecting your real schema:**

```bash
node scripts/inspect-schema.js
```

This prints every sheet's actual column headers. Compare them against
`DATA_MAPPING.md` and fix any mismatches in `backend/data/normalize.js`.
Do not skip this — the calculation engine trusts header names, and if a
name has changed, you'll get a clear `DataSchemaError` instead of a wrong
number, but only once real requests start flowing through it.

## 4. Configure the Admin email

Already set to `alirezamohamadi319@gmail.com` in `.env.example`
(Section 8). Change `ADMIN_EMAIL` if needed.

## 5. Create the first user (Admin)

The Admin account is auto-created on first server boot. If you don't set
`ADMIN_INITIAL_PASSWORD` in `.env`, the server generates one and prints it
to the console **once** — copy it immediately, you'll be forced to change
it on first login:

```bash
npm start
# look for a boxed message in the terminal with the generated password
```

## 6. Run it locally

```bash
npm start
# or, for auto-restart on file changes:
npm run dev
```

Then open `http://localhost:4000/login.html`.

## 7. Run the test suite

```bash
npm test
```

This runs 30 tests covering every KPI scoring boundary and every churn
edge case from Section 52 of the spec, using Node's built-in test runner
(no extra dependency).

## 8. Create Managers and Agents

Log in as Admin, then either use the Admin API directly or wait for the
Admin panel UI (scaffolded API, UI not yet built — see below):

```bash
curl -b cookies.txt -X POST http://localhost:4000/api/admin/users \
  -H 'Content-Type: application/json' \
  -d '{"email":"manager@okala.com","name":"Manager Name","role":"manager"}'

curl -b cookies.txt -X POST http://localhost:4000/api/admin/users \
  -H 'Content-Type: application/json' \
  -d '{"email":"majidi.saeid@okala.com","name":"Saeid Majidi","role":"agent","assignedAgent":"majidi.saeid"}'
```

Each call returns a one-time `initialPassword` for you to relay to that
person securely (no SMTP integration was specified, so this isn't emailed
automatically).

## 9. Configure KPI targets and bonus amounts

```bash
curl -b cookies.txt -X POST http://localhost:4000/api/admin/kpi-config \
  -H 'Content-Type: application/json' \
  -d '{"city":"Tehran","provider":"Supermarket","kpi":"NFC","target":2.0,"bonusAmount":2500000,"effectiveFrom":"2026-01-01"}'
```

Repeat per City/Provider/KPI combination — see the amounts in the original
brief (Section 26) as starting values.

## 10. Deploy it

This is a plain Node/Express app + static frontend, so it runs anywhere
that runs Node 22+:
- **Simplest:** a small VM (or Railway/Render/Fly.io) running `npm start`
  behind a reverse proxy (nginx/Caddy) terminating HTTPS.
- **Serverless:** Vercel Functions or Cloud Run both work, but the
  in-memory `CacheStore` and `RateLimiter` (see ARCHITECTURE.md) need to
  move to Redis first if you run more than one instance — serverless
  platforms will spin up multiple instances under load.
- **Database:** SQLite (`data/okala.db`) works fine for a single instance.
  For multi-instance deployments, point `DB_PATH`-equivalent config at
  Postgres instead (would require swapping `backend/db/init.js`'s
  `node:sqlite` calls for a Postgres client — the schema in `schema.sql`
  is close to portable SQL already).

I cannot provision cloud infrastructure or deploy this for you from this
chat session — the steps above are what you (or whoever manages your
infra) would run.

## 11. Troubleshooting data errors

If the dashboard shows `DATA SOURCE ERROR` or `CALCULATION ERROR`, it's
telling you exactly which sheet, which column, and what was expected vs.
found (Section 7) — check `/api/admin/logs/refresh` (Admin/Manager only)
for the full history, or the terminal running the server for
`console.error` output. Never treat these as "something broke randomly" —
they always point at a specific missing/misnamed field.

## What's left to build

See `ARCHITECTURE.md` → "What's implemented vs. scaffolded" for the honest
list. In priority order, next steps are: (1) confirm the open questions in
`DATA_MAPPING.md` against your real sheets, (2) build the Admin panel UI
on top of the already-working Admin API, (3) build the charts/heatmap/map
views on top of `/api/dashboard/overview`'s already-normalized vendor data.
