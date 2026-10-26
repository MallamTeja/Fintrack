# FinTrack frontend

React 18 + Vite single-page app for the FinTrack API. Plain CSS with design tokens, hand-built SVG charts, no UI kit.

## Scripts

| Command           | What it does                                              |
| ----------------- | --------------------------------------------------------- |
| `npm run dev`     | Dev server on :5173, proxies `/api` to `localhost:5000`   |
| `npm run build`   | Production build into `dist/`                             |
| `npm run preview` | Serves `dist/` (same `/api` proxy)                        |
| `npm test`        | Vitest + Testing Library (formatting, analytics, auth, forms, routes, dashboard) |

## Structure

```
src/
  main.jsx, App.jsx        router, providers, auth guards
  lib/api.js               fetch wrapper: bearer token, one refresh on 401, error shape
  lib/useResource.js       tiny data hook + invalidate(key) bus
  lib/realtime.js          Supabase Realtime (optional, lazy-loaded)
  lib/data.js              resource fetchers and normalisers (fetchAllTransactions pages through a range)
  lib/analytics.js         pure dashboard maths: periods, month buckets, deltas, top N, pace, heatmap, goals
  lib/format.js            money (Intl, en-IN for INR) and dates
  lib/validate.js          client rules mirroring the API
  context/                 Auth, Theme, Toast
  components/              AppShell, Modal (drawer/dialog), Money, Charts, Icon
  pages/                   Auth, Dashboard, Transactions, Budgets, Savings, Settings, 404
  styles/tokens.css        every colour, font, space, radius and duration
  styles/base.css          reset, type, buttons, fields
  test/                    vitest specs
```

## Dashboard

`/` (alias `/dashboard`) is the Dashboard. It loads every transaction for the last 13 months
(`/api/transactions?startDate&endDate&limit=500&page=N`, following `pagination.totalPages`, at most 10 pages),
plus `/api/budgets` and `/api/savings-goals`, and works everything out client side in `src/lib/analytics.js`.

- Period control: This month (1st to today, against the same days of last month), Last 3 months and Last 12 months
  (trailing windows to today, against the equal window before). The 12 month comparison fetches the 12 months before
  that range on demand. The period is kept in the URL as `?period=3m` or `?period=12m`.
- KPIs follow the period: income, spending, net saved, savings rate (n/a when there is no income), average daily
  spend and entry count, each with its change against the previous period. More income or saving is green, more
  spending is brick.
- Charts are hand-built SVG in `src/components/Charts.jsx`: 12 month cash flow (income and spending bars, net line),
  ranked category bars (top 6 plus Other), cumulative spending pace against last month, a 12 week daily heatmap
  (quartile shades of brick), and income sources. Cash flow and pace take keyboard focus; arrow keys move the tooltip.
  Every chart has a visually hidden table or live text for screen readers.
- Budget health (most at risk first), savings goals with the monthly amount needed to meet the due date,
  computed insights, and the eight most recent entries.
- Data refreshes through the same `invalidate('transactions' | 'budgets' | 'savings')` bus that Realtime uses.

## Design tokens

All colours are OKLCH custom properties in `src/styles/tokens.css`; components only use `var(--...)`.
The light theme is warm paper (`--color-paper`) with ink text. There is one ledger-green accent for money in and
primary actions (`--color-accent`), brick for money out and destructive actions (`--color-out`), and ochre for
budgets at 80% or more (`--color-warn`, `--color-warn-bar`). The heatmap uses a single-hue brick scale
(`--color-heat-0` to `--color-heat-4`). The dark theme follows `prefers-color-scheme`
unless the user picks one; that choice is stored in `localStorage.theme` and in account preferences.
The WCAG contrast ratios are listed at the top of the token file.

Type: Fraunces (display, optical sizing) and Instrument Sans (UI), both self-hosted through `@fontsource-variable`.
Money always uses tabular lining figures.
Spacing follows a 4px scale (`--sp-1` to `--sp-20`). The radius is 6px. Motion runs 150-200ms and is
disabled under `prefers-reduced-motion`.
