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
| Frontend | Static HTML + Tailwind + vanilla JS / Chart.js (`frontend/public`) |
| API | Node 22, Express (`backend/`), deployed as one Vercel function |
| Auth | Supabase Auth (email + password, JWT access and refresh tokens) |
| Database | Supabase Postgres with Row Level Security (`supabase/migrations`) |
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
npm run dev                   # http://localhost:5000
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
| POST | `/api/auth/register` | `name, email, password` (8+ chars, upper, lower, digit) |
| POST | `/api/auth/login` | `email, password` → `{ token, refreshToken, expiresAt, user }` |
| POST | `/api/auth/refresh` | `refreshToken` |
| POST | `/api/auth/logout` | revokes the session |
| GET | `/api/auth/me` | profile and preferences |
| PUT | `/api/auth/preferences` | `theme` (`light`/`dark`), `currency` (ISO code), `notifications` |
| GET | `/api/transactions` | `?type&category&startDate&endDate&page&limit` → `{ data, pagination }` |
| POST | `/api/transactions` | `description, amount, type, category, date?` |
| GET / PUT / PATCH / DELETE | `/api/transactions/:id` | |
| GET | `/api/transactions/stats/summary` | totals by type and category |
| GET / POST | `/api/budgets` | `category, limit`; list includes `current_spending` for this month |
| PUT / PATCH / DELETE | `/api/budgets/:id` | `limit` |
| GET / POST | `/api/savings-goals` (alias `/api/savings`) | `title, target_amount, current_amount?, category?, due_date?` |
| PUT / PATCH / DELETE | `/api/savings-goals/:id` | |

Errors are `{ success: false, error: { message } }` with a matching HTTP status.

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
frontend/public/         pages, scripts and styles (js/api.js adds the token to every API call)
supabase/
  config.toml            local stack settings
  migrations/            schema, RLS policies, grants
```

## Known gaps

- The Savings Goals and Settings pages have no page logic yet (their scripts never existed).
- "Upload statement" on the Add Transaction page has no backend.
- Pages use inline scripts, so Content-Security-Policy is off.
- Tokens live in `localStorage`.

See [SECURITY.md](SECURITY.md) for the security model and [CONTRIBUTING.md](CONTRIBUTING.md) to help.

Built by [Teja Mallam](https://github.com/MallamTeja) with
[Karthik](https://github.com/Karthik-177), Kopparthi Rakesh and
[Sri Sai Deepak Maddineni](https://github.com/maddinenisrisaideepak).

## License

[MIT](LICENSE)
