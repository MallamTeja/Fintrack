# FinTrack

[![CI](https://github.com/MallamTeja/Fintrack/actions/workflows/ci.yml/badge.svg)](https://github.com/MallamTeja/Fintrack/actions/workflows/ci.yml)
[![CodeQL](https://github.com/MallamTeja/Fintrack/actions/workflows/codeql.yml/badge.svg)](https://github.com/MallamTeja/Fintrack/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Personal finance tracker: log income and expenses, set monthly budgets per category
and track savings goals.

**Live:** https://fintrack-project1.vercel.app

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite, plain CSS design tokens, hand-built SVG charts (`frontend/`) |
| API | Node 22, Express (`backend/`), deployed as one Vercel function |
| Auth | Supabase Auth (email + password, JWT access and refresh tokens) |
| Database | Supabase Postgres with Row Level Security (`supabase/migrations`) |
| Live updates | Supabase Realtime (websocket) pushes row changes to open tabs |
| CI | GitHub Actions: tests against a local Supabase, CodeQL, gitleaks, npm audit, Dependabot |

## How it works

```
Browser ──fetch /api/* (Bearer <Supabase access token>)──► Express (Vercel function)
                                                              │ verifies token with Supabase Auth
                                                              │ queries as that user (anon key + user JWT)
                                                              ▼
                                                   Supabase Postgres ── RLS: user_id = auth.uid()
```

The API never uses the service-role key. Every query runs as the signed-in user,
so Postgres itself guarantees that people only see their own data, even if a
route had a bug. `user_id` is filled from the token by a column default and is not
writable by clients (column-level grants).

## Run locally

Requirements: Node 20.12+, Docker (for the local Supabase stack).

```bash
git clone https://github.com/MallamTeja/Fintrack.git
cd Fintrack
npx supabase start            # local Postgres + Auth, applies supabase/migrations
npx supabase status -o env    # shows API_URL and ANON_KEY

cd backend
cp .env.example .env          # put API_URL into SUPABASE_URL and ANON_KEY into SUPABASE_ANON_KEY
npm install
npm run dev                   # API on http://localhost:5000

cd ../frontend
npm install
npm run dev                   # app on http://localhost:5173 (proxies /api to :5000)
```

### Environment variables

| Name | Required | Notes |
|---|---|---|
| `SUPABASE_URL` | yes | Project URL |
| `SUPABASE_ANON_KEY` | yes | Anon / publishable key (`SUPABASE_PUBLISHABLE_KEY` also accepted) |
| `PORT` | no | Default `5000` |
| `FRONTEND_URL` | no | Comma-separated extra origins allowed by CORS |

On Vercel these are set automatically by the Supabase integration. The server refuses
to start without them. `.env` files are git-ignored and CI scans every push for secrets.

### Database changes

Add a new file in `supabase/migrations/` (`npx supabase migration new <name>`), test it
locally with `npx supabase db reset`, then push to `main`: the Supabase GitHub
integration applies it to production. Every new table needs RLS policies and explicit grants.

## API

All routes except `/api/health`, `/api/auth/register`, `/api/auth/login` and
`/api/auth/refresh` need `Authorization: Bearer <access token>`.

| Method | Path | Body / query |
|---|---|---|
| GET | `/api/health` | |
| POST | `/api/auth/register` | `name` (1-60, letters, spaces, `.'-`), `email` (max 254), `password` (8-72, upper, lower, digit) |
| POST | `/api/auth/login` | `email, password` → `{ token, refreshToken, expiresAt, user }` |
| POST | `/api/auth/refresh` | `refreshToken` |
| POST | `/api/auth/logout` | revokes the session |
| GET | `/api/auth/me` | profile: `name` and `preferences` (all fields below) |
| PUT | `/api/auth/preferences` | any of `name`, `theme` (`light`/`dark`), `currency` (`INR USD EUR GBP AED SGD AUD CAD JPY`), `notifications` (bool), `month_start_day` (1-28), `date_format` (`DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD`), `week_start` (`monday`/`sunday`), `monthly_income_target` (amount or `null`), `budget_alerts` (bool) → `{ preferences, user }` |
| POST | `/api/auth/password` | `currentPassword, newPassword`; 401 if the current password is wrong, 400 if the new one is weak. Other sessions are signed out |
| DELETE | `/api/auth/account` | `{ "confirm": "DELETE" }`; deletes the user and all their data |
| GET | `/api/transactions` | `?type&category&q&source&payment_method&startDate&endDate&page&limit` → `{ data, pagination }` |
| POST | `/api/transactions` | `amount, type, category, description?, date?, notes?, payment_method?` |
| GET / PUT / PATCH / DELETE | `/api/transactions/:id` | |
| GET | `/api/transactions/stats/summary` | same filters; totals by type and category |
| GET | `/api/transactions/categories` | `[{ category, type, count }]`, most used first |
| GET | `/api/transactions/export.csv` | same filters (usually `startDate, endDate`); CSV download |
| POST | `/api/transactions/import` | `{ fileName, rows: [{ date, description, amount, type, category, payment_method?, notes? }] }` (1-2000 rows, 1mb) → `{ received, inserted, duplicates, invalid: [{ index, errors }] }` |
| GET / POST | `/api/budgets` | `category, limit`; list includes `current_spending` for this month |
| PUT / PATCH / DELETE | `/api/budgets/:id` | `limit` |
| GET / POST | `/api/savings-goals` (alias `/api/savings`) | `title, target_amount, current_amount?, category?, due_date?` |
| PUT / PATCH / DELETE | `/api/savings-goals/:id` | |

Validation rules (requests that break them get a 400 listing every problem; unknown fields are ignored):

- **Amounts** (`amount`, `limit`, `target_amount`, `monthly_income_target`): greater than 0, at most 1,000,000,000, at most 2 decimals. `current_amount` may be 0 and at most 10 times `target_amount`.
- **Transactions**: `type` is `income` or `expense`; `category` 1-50 characters, letters, numbers, spaces and `& - / . , ' ( )`; `description` 0-200; `notes` 0-500; `payment_method` one of `upi card cash bank wallet other` (default `other`); `date` ISO 8601, from 1970-01-01 up to 1 day ahead. Control characters are stripped from text.
- **Savings goals**: `title` 1-100, `category` 0-50, `due_date` a valid date, not in the past when creating.
- **Query**: `page` 1-10000, `limit` 1-500 (default 100), `type` as above, `category` up to 50, `q` up to 100 (matches description or category, case-insensitive, literal), `source` `manual`/`import`, `payment_method` as above, `startDate`/`endDate` ISO dates with `endDate >= startDate`; a date-only `endDate` includes that whole day.

Each transaction has `notes`, `payment_method` and `source` (`manual` or `import`).
**Import** fingerprints every row on the server as sha256 of `date|type|amount|description`
(date as `YYYY-MM-DD`, amount with 2 decimals, description lowercased with spaces collapsed).
Rows already imported, or repeated in the same file, count as `duplicates` and are skipped;
invalid rows are reported by index and the rest are still imported. Limited to 10 imports per 15 minutes.
**Export** columns are `date, type, category, description, amount, payment_method, notes, source`; cells that
start with `= + - @` are prefixed with `'` so spreadsheets never run them as formulas.

Errors are `{ success: false, error: { message, details? } }` with a matching HTTP status.

## Tests

```bash
cd backend
npm run test:unit          # no services needed
npm test                   # unit + integration; needs `npx supabase start` and backend/.env
```

The integration suite signs up real users against the local stack and checks auth
(login, refresh, logout, forged tokens, generic errors), CRUD for every resource,
validation, literal matching of search input, and that one user can never read,
change or delete another user's rows.

## Project structure

```
backend/
  server.js              entry point (exports the app for Vercel)
  src/app.js             middleware, routes, static files
  src/auth.js            bearer token -> Supabase user + per-user DB client
  src/routes/            auth, transactions, budgets, savings
  src/validate.js        input validation
  tests/                 unit + integration (Jest, Supertest)
api/index.js             Vercel function entry (re-exports the Express app)
frontend/src/            React app: pages, components, lib (API client, realtime), styles/tokens.css
supabase/
  config.toml            local stack settings
  migrations/            schema, RLS policies, grants
```

## Design

"Editorial ledger": warm paper, ink text, one ledger-green accent for money in and brick for money out, Fraunces + Instrument Sans,
tabular figures for every amount. Every colour is an OKLCH token in `frontend/src/styles/tokens.css` with its WCAG contrast ratio
noted, in light and dark. Built against the [Hallmark](https://github.com/Nutlope/hallmark) anti-slop rules.

## Known gaps

- Tokens live in `localStorage`.
- Statement import parses files in the browser; scanned PDFs (images) need OCR, which is not supported.

See [SECURITY.md](SECURITY.md) for the security model and [CONTRIBUTING.md](CONTRIBUTING.md) to help.

Built by [Teja Mallam](https://github.com/MallamTeja) with
[Karthik](https://github.com/Karthik-177), Kopparthi Rakesh and
[Sri Sai Deepak Maddineni](https://github.com/maddinenisrisaideepak).

## License

[MIT](LICENSE)
