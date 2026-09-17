# Kitchen Inventory

Single-file PWA for kitchen inventory and recipes with "what can I make
right now" matching. Vanilla HTML/CSS/JS, no build step. Hosted on GitHub
Pages, installable via Safari "Add to Home Screen" on iOS. Works on phone
and laptop; data syncs across devices through Supabase.

## Features

**Inventory** — ingredients grouped by category (collapsible), plus an
equipment list. One-tap state cycling (have → low → out), one-tap
own/don't-own for equipment. Staples are dimmed. You add and manage
inventory here yourself — nothing else writes to it.

**Cook** — recipes with an ingredient list, sectioned method (e.g.
"Marination" / "Gravy", swipeable in Cooking mode like a carousel), and
categories (Breakfast/Lunch/Dinner/Sauces/etc, collapsible groups). Recipe
ingredients are plain text — typing one never creates or changes an
inventory row. If a recipe ingredient's name matches something in your
inventory, its live have/low/out status shows on the line, in the recipe
editor and in Cooking mode alike; "can make now" filters recipes whose
tracked ingredients aren't `out` (`low` still counts, untracked ingredients
are assumed present). Cooking mode also shows a banner at the top listing
anything you're out of or running low on for that recipe.

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

1. Run the files in `supabase/migrations/` in order (by filename/date) in
   the Supabase SQL editor.
2. The project URL + anon key are already baked into `index.html`.
3. GitHub Pages: Settings → Pages → Deploy from branch → `main` / root.

## Local dev

```sh
npx serve .        # or any static server; needs localhost/HTTPS for the SW
npm test           # jsdom suite (Node 18+; installs jsdom as a dev dep)
```
