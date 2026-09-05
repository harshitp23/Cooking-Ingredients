# Kitchen Inventory

Single-file PWA for kitchen inventory + a derived shopping list.
Vanilla HTML/CSS/JS, no build step. Hosted on GitHub Pages, installable
via Safari "Add to Home Screen" on iOS.

Backend: Supabase (`kitchen_`-prefixed tables in a shared project).

## Phase 1 (current)

- **Inventory** — ingredients grouped by category, equipment list. One-tap
  state cycling (have → low → out), one-tap own/don't-own for equipment.
- **Shopping** — auto-derived from low/out non-staple ingredients, plus
  local-only one-off items. Tap to check off (sets the item back to "have").
- Optimistic UI, undo toasts (no confirm dialogs), offline-first: renders
  from a localStorage cache, queues failed writes and flushes them in order
  when back online (idempotent).

Phase 2 (recipes, "what can I make") is not built yet; the schema already
has the tables so it needs no migration to existing columns.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | the whole app |
| `sw.js` | service worker — caches the shell + supabase-js for offline launch |
| `manifest.webmanifest` | PWA manifest |
| `icon-*.png`, `apple-touch-icon.png` | icons (regenerate with `node tools/gen-icons.mjs`) |
| `supabase/migrations/` | SQL schema — paste into the Supabase SQL editor |

## Local dev

```sh
python -m http.server 8000   # then open http://localhost:8000
```

A service worker needs `localhost` or HTTPS; opening `index.html` via
`file://` works too but without offline caching.
