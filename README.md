# Kitchen Inventory

Single-file PWA for kitchen inventory, a derived shopping list, and recipes
with "what can I make right now" matching. Vanilla HTML/CSS/JS, no build step.
Hosted on GitHub Pages, installable via Safari "Add to Home Screen" on iOS.
Works on phone and laptop; data syncs across devices through Supabase.

## Features

**Inventory** — ingredients grouped by category (collapsible), plus an
equipment list. One-tap state cycling (have → low → out), one-tap
own/don't-own for equipment. Staples are dimmed and never hit the shopping
list.

**Shopping** — auto-derived from low/out non-staple ingredients (`out`
first), plus local-only one-off items (e.g. birthday candles). Tap to check
off — that sets the ingredient back to "have".

**Cook** — recipes with an ingredient list (each line shows the ingredient's
live inventory state), a free-text method, and servings. "Can make now"
filters to recipes whose ingredients are all in stock — `low` still counts,
only `out` blocks. Adding a recipe ingredient you don't stock creates it as
`out`, so it lands on the shopping list.

**Everywhere** — optimistic UI, undo toasts instead of confirm dialogs
(deletes included), and offline-first: renders from a `localStorage` cache,
reconciles with Supabase, and queues failed writes to flush in order when
back online. The flush is idempotent — a partial flush that retries never
double-applies.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | the whole app |
| `sw.js` | service worker — caches the shell + supabase-js for offline launch |
| `manifest.webmanifest` | PWA manifest |
| `icon-*.png`, `apple-touch-icon.png` | icons (regenerate: `node tools/gen-icons.mjs`) |
| `supabase/migrations/` | SQL schema — paste each file into the Supabase SQL editor, in order |
| `test/` | jsdom test suite (`npm test`) |

## Setup

1. Run `supabase/migrations/20260905000000_kitchen_phase1.sql` then
   `20260906000000_kitchen_phase2.sql` in the Supabase SQL editor.
2. The project URL + anon key are already baked into `index.html`.
3. GitHub Pages: Settings → Pages → Deploy from branch → `main` / root.

## Local dev

```sh
npx serve .        # or any static server; needs localhost/HTTPS for the SW
npm test           # jsdom suite (Node 18+; installs jsdom as a dev dep)
```
