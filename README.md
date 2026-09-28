# Kitchen Inventory

Single-file PWA for what's in your kitchen plus a shopping list that fills
itself. Vanilla HTML/CSS/JS, no build step. Hosted on GitHub Pages,
installable via Safari "Add to Home Screen" on iOS. Works on phone and
laptop; data syncs across devices through Supabase.

(Recipes used to live here too — they've moved to ReciMe. The recipe tables
are still in the database, untouched; the app just doesn't show them.)

## Features

**Inventory** has three sections, switched with the segmented control at the top:

- **Ingredients** are grouped into your own categories (Dairy, Spices, …).
  Each item is **In stock → Low → Out**; tap the status chip to cycle it.
  Every category card has a **+** for adding straight into it and a **⋯**
  menu to rename it, remove it (its items are kept, just uncategorized) or
  collapse/expand everything. "Running low" / "Out" filter chips show only
  what needs attention.
- **Snacks** have a count, e.g. "2 × salted chips", with a − / + stepper.
- **Equipment** has a count too, e.g. "1 frying pan, 3 mixing bowls".

Search filters the current section. Tap any item to edit its name, category,
status or count, and notes, or to add it to the shopping list by hand.

**Shopping list** is organised into categories and shows a progress bar.
It's linked to Inventory:

- An ingredient going **Out** is added automatically, under a list category
  with the same name as its inventory category ("Other" if it has none).
  A snack dropping to **0** is added under "Snacks". Equipment is never
  auto-added.
- Setting it back to In stock / Low (or the snack back above 0) takes it
  off the list again, but only while it's still unticked.
- **Ticking an item off restocks it**: the matching ingredient goes back to
  In stock, and a snack at 0 goes to 1. One Undo reverts both.
- Mark an ingredient as a **Staple** to stop it ever being auto-added.
- Items you add to the list yourself never change your inventory.

**Everywhere:** optimistic UI, undo toasts instead of confirm dialogs, and
offline-first. It renders from a `localStorage` cache, reconciles with
Supabase, and queues writes to flush in order when back online. The flush is
idempotent. A write the database rejects for schema reasons (a migration not
run yet) is parked in the queue without blocking other writes, and the sync
pill says "Needs DB update".

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
   the Supabase SQL editor. The newest,
   `20260928000000_kitchen_snacks_counts.sql`, adds Snacks and counts.
2. The project URL + anon key are already baked into `index.html`.
3. GitHub Pages: Settings → Pages → Deploy from branch → `main` / root.

## Local dev

```sh
npx serve .        # or any static server; needs localhost/HTTPS for the SW
npm test           # jsdom suite (Node 18+; installs jsdom as a dev dep)
```
