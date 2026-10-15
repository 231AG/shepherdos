# ShepherdOS demo

A clickable, front-end-only demo of **ShepherdOS**, a multi-church management platform for Liberian churches: members, Sunday check-in that works offline, LRD and USD giving, and SMS.

Everything runs in the browser on fictional, generated data. There is no backend, no real sign-in and no real SMS. It is a static export hosted on Vercel.

> Status: **Phase 1 of 6** (foundation, demo sign-in, role switching, church switching, church dashboard, platform console overview). Modules from later phases show a short "arrives in phase N" screen.

## Run it locally

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # static export into ./out
npm run serve        # serves ./out on http://localhost:4173
npm run lint
```

Requires Node 20+.

## How the mock data layer works

```
src/mock/seed.ts     generates the demo data (only the repository imports it)
src/mock/prng.ts     seeded random numbers + stable UUIDs (uuidFrom("member:grace:17"))
src/data/types.ts    domain types shaped like the spec's data model
src/data/store.ts    zustand store, persisted to localStorage (versioned)
src/data/repo.ts     the repository: every read and write goes through here
```

- **Generated relative to today.** The seed is rebuilt on every page load from the current date, so "last 12 Sundays" are always the most recent 12 Sundays and nothing looks stale.
- **Deterministic.** A seeded PRNG makes the data identical on every load and every reset.
- **Stable ids.** Records get UUIDs derived from a fixed key, so a member keeps the same id from day to day.
- **Visitor changes are deltas.** Only what the visitor adds or changes is saved (`added` rows and `patched` fields per table) under the `shepherdos-demo` localStorage key. "Reset demo data" clears the deltas. If storage is unavailable (private browsing), the store falls back to memory.
- **Spec rules are kept even in the demo.** Every church-owned row has `church_id`; money is integer minor units plus `LRD` or `USD` and is never summed across currencies; the giving ledger is append-only with linked reversal rows; member status (New / Active / Inactive / Excused) is derived from attendance and the church's thresholds, never stored.
- **Roles.** `src/lib/access.ts` holds the role matrix (which modules each role can open, ledger visibility, contact masking). Department heads are scoped to their department through `getScope()` in the repository.

### What the full version replaces

Only `src/data/repo.ts` (and `src/data/store.ts` for local UI state) change. Queries become Supabase reads under row-level security; commands (`logFollowUpNote`, `syncNow`, later `checkIn`, `postGiving`, `reverseGiving`) become server actions or Postgres RPCs; the offline queue moves to IndexedDB behind a service worker. Components keep calling the same functions. `src/mock/` is deleted.

## Swapping the logo

The placeholder logo lives in one component: `src/components/brand/Logo.tsx`.

1. Replace the `<svg>` inside `LogoMark` with the real mark (keep a square `viewBox`). Adjust the wordmark in `Logo` if needed.
2. Regenerate the favicon and app icons from it:
   ```bash
   npm run build
   npm run serve        # leave running
   npm run icons        # writes public/icons/* and public/favicon.ico
   ```
   The script screenshots the hidden `/brand-preview/` page, which renders `LogoMark`.
3. Optionally refresh the landing page screenshot with `npm run shots:landing`.

## Design tokens

Colours, fonts and shadows are Tailwind theme tokens in `src/app/globals.css`. The default Tailwind palette is removed, so components can only use the ShepherdOS tokens. Teal text and white-on-teal buttons use `teal-ink` (#0E6B63) for WCAG AA contrast; `teal` (#16877E) is for fills, icons and charts.

## Visual checks

```bash
npm run build && npm run serve   # in one terminal
node scripts/screenshot.mjs http://localhost:4173 ./shots pastor /c/grace-fellowship/   # 390, 768, 1440 px
node scripts/smoke.mjs           # clicks through the main demo flows
node scripts/find-overflow.mjs http://localhost:4173/platform/ 390 operator
```

The scripts use `playwright-core` with a local Chromium (`CHROMIUM` env var to override the path).

## Deploying (Vercel)

Import the GitHub repository in Vercel with the **Next.js** framework preset and default settings: build command `npm run build`. Because `next.config.ts` sets `output: "export"`, Vercel serves the generated `out` folder as static files. `trailingSlash: true` emits `/members/index.html`-style files, so clean URLs work without extra rewrites. Every push to `main` deploys to production; pull requests get preview URLs.
