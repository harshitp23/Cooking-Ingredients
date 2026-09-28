-- ============================================================================
-- Kitchen Inventory app — Snacks + counts (Cook tab removed)
--
-- Inventory is now three sections: Ingredients (have / low / out, grouped by
-- category), Snacks and Equipment (both tracked as a whole-number count —
-- "2 bags of chips", "1 frying pan").
--
--   * kitchen_items.kind gains 'snack'.
--   * kitchen_items.qty holds the count for snacks + equipment (null for
--     ingredients, which keep using `state`). `state` is still kept in sync
--     for counted rows (qty > 0 -> 'have', qty = 0 -> 'out').
--   * Existing equipment is backfilled from its old own / don't-own state.
--
-- The recipe tables are left untouched (nothing is deleted) — the app just no
-- longer reads them. The one change there: the legacy recipe-line -> item link
-- used ON DELETE RESTRICT, which would stop you deleting an inventory item
-- that an old recipe once linked to. It now just clears the link instead.
--
-- Paste into the Supabase SQL editor and run once, after the earlier
-- migrations. Safe to re-run. The app tolerates this not having been run yet:
-- equipment shows 1/0 from its old state, and any write that needs the new
-- column waits in the queue (without blocking other writes) until it has.
-- ============================================================================

alter table public.kitchen_items
  add column if not exists qty integer;

alter table public.kitchen_items
  drop constraint if exists kitchen_items_kind_check;
alter table public.kitchen_items
  add constraint kitchen_items_kind_check
  check (kind in ('ingredient', 'equipment', 'snack'));

alter table public.kitchen_items
  drop constraint if exists kitchen_items_qty_check;
alter table public.kitchen_items
  add constraint kitchen_items_qty_check
  check (qty is null or qty >= 0);

update public.kitchen_items
set qty = case when state = 'out' then 0 else 1 end
where kind = 'equipment' and qty is null;

-- Legacy recipe-line link: clear it instead of blocking the item delete.
-- (Column-list SET NULL needs Postgres 15+, which Supabase runs.)
alter table public.kitchen_recipe_items
  drop constraint if exists kitchen_recipe_items_item_fk;
alter table public.kitchen_recipe_items
  add constraint kitchen_recipe_items_item_fk
  foreign key (item_id, user_id)
  references public.kitchen_items (id, user_id) on delete set null (item_id);
