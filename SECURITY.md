# Security Policy

## Reporting a vulnerability

Please do **not** open a public issue. Use GitHub's
[private vulnerability report](https://github.com/MallamTeja/Fintrack/security/advisories/new).
Expect an acknowledgement within 72 hours. Only `main` is supported.

## Security model

| Control | Where |
|---|---|
| Accounts, password hashing and sessions handled by Supabase Auth | `backend/src/routes/auth.js` |
| Every API request verifies the bearer token with Supabase Auth | `backend/src/auth.js` |
| Queries run as the user (anon key + user JWT); the service-role key is never used | `backend/src/supabase.js` |
| Row Level Security on every table: `user_id = auth.uid()` | `supabase/migrations/` |
| `user_id`, ids and timestamps are not client-writable (column grants) | `supabase/migrations/` |
| `anon` role has no table access | `supabase/migrations/` |
| Input validation with field allow-lists; search text matched literally | `backend/src/validate.js` |
| Rate limits (300 req / 15 min per IP, 20 on auth routes) and Supabase Auth limits | `backend/src/app.js` |
| helmet headers, CORS allow-list, 50 kB body limit, generic 5xx messages | `backend/src/app.js` |
| CodeQL, gitleaks, `npm audit`, Dependabot | `.github/` |

## Known gaps

- Access and refresh tokens are kept in `localStorage`.

## Past incident

MongoDB credentials and JWT secrets were committed in 2025. They were removed from the
git history in October 2026, and the app moved to Supabase. The old database must be
treated as compromised and deleted.
