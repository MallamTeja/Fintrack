# FinTrack frontend

React 18 + Vite single-page app for the FinTrack API. Plain CSS with design tokens, hand-built SVG charts, no UI kit.

## Scripts

| Command           | What it does                                              |
| ----------------- | --------------------------------------------------------- |
| `npm run dev`     | Dev server on :5173, proxies `/api` to `localhost:5000`   |
| `npm run build`   | Production build into `dist/`                             |
| `npm run preview` | Serves `dist/` (same `/api` proxy)                        |
| `npm test`        | Vitest + Testing Library (formatting, auth, forms, routes) |

## Structure

```
src/
  main.jsx, App.jsx        router, providers, auth guards
  lib/api.js               fetch wrapper: bearer token, one refresh on 401, error shape
  lib/useResource.js       tiny data hook + invalidate(key) bus
  lib/realtime.js          Supabase Realtime (optional, lazy-loaded)
  lib/data.js              resource fetchers and normalisers
  lib/format.js            money (Intl, en-IN for INR) and dates
  lib/validate.js          client rules mirroring the API
  context/                 Auth, Theme, Toast
  components/              AppShell, Modal (drawer/dialog), Money, Charts, Icon
  pages/                   Auth, Overview, Transactions, Budgets, Savings, Settings, 404
  styles/tokens.css        every colour, font, space, radius and duration
  styles/base.css          reset, type, buttons, fields
  test/                    vitest specs
```

## Design tokens

All colours are OKLCH custom properties in `src/styles/tokens.css`; components only use `var(--...)`.
The light theme is warm paper (`--color-paper`) with ink text. There is one ledger-green accent for money in and
primary actions (`--color-accent`), brick for money out and destructive actions (`--color-out`), and ochre for
budgets at 80% or more (`--color-warn`, `--color-warn-bar`). The dark theme follows `prefers-color-scheme`
unless the user picks one; that choice is stored in `localStorage.theme` and in account preferences.
The WCAG contrast ratios are listed at the top of the token file.

Type: Fraunces (display, optical sizing) and Instrument Sans (UI), both self-hosted through `@fontsource-variable`.
Money always uses tabular lining figures.
Spacing follows a 4px scale (`--sp-1` to `--sp-20`). The radius is 6px. Motion runs 150-200ms and is
disabled under `prefers-reduced-motion`.
