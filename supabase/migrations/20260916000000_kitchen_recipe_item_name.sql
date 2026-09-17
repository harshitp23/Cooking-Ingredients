-- ============================================================================
-- Kitchen Inventory app — recipe ingredients are free text, not forced links
--
-- Previously, typing a recipe ingredient that wasn't in your inventory
-- silently created a kitchen_items row for it. That's no longer wanted:
-- writing a recipe should never touch your inventory. Recipe lines now
-- store their own ingredient name; matching to a live have/low/out status
-- (for the Cook / Cooking-mode views) happens client-side by name lookup
-- against kitchen_items, not via a stored link.
--
-- Paste into the Supabase SQL editor and run once, after the earlier
-- migrations. Safe to re-run.
-- ============================================================================

alter table public.kitchen_recipe_items
  add column if not exists name text;

-- Backfill: any existing lines that DO have a linked item get that item's
-- name copied in, so nothing already saved shows up blank.
update public.kitchen_recipe_items ri
set name = ki.name
from public.kitchen_items ki
where ri.item_id = ki.id and ri.name is null;

-- item_id is no longer required — new lines are written with item_id = null.
-- (The composite FK stays in place for any row that still sets it; a FK
-- with a null column is simply not checked, so this is safe.)
alter table public.kitchen_recipe_items
  alter column item_id drop not null;

alter table public.kitchen_recipe_items
  alter column name set not null;
