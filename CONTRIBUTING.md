# Contributing

1. Branch from `main`: `git checkout -b feat/short-description`.
2. Start the local stack: `npx supabase start` (Docker required), then follow "Run locally" in the README.
3. Schema changes go in a new migration (`npx supabase migration new <name>`) with RLS policies and grants.
4. Run `cd backend && npm test` before pushing; CI runs the same suite against a fresh local Supabase.
5. Never commit `.env` files or keys.
6. Use [Conventional Commits](https://www.conventionalcommits.org/) and keep each pull request to one change.
