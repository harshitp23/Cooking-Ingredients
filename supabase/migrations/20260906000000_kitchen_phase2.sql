-- ============================================================================
-- Kitchen Inventory app — Phase 2 (recipes + "what can I make")
-- Paste into the Supabase SQL editor and run once, after the Phase 1 migration.
--
-- Purely additive: two new nullable columns on kitchen_recipes. No existing
-- column is altered; kitchen_recipe_items already has display_qty + sort_order
-- from Phase 1; RLS + FKs are already in place. Safe to re-run.
-- ============================================================================

alter table public.kitchen_recipes
  add column if not exists instructions text;

alter table public.kitchen_recipes
  add column if not exists servings integer
  check (servings is null or servings > 0);

-- Recipe lines are looked up by recipe (already indexed: kitchen_recipe_items_recipe_idx)
-- and, for "which recipes use this item", by item (kitchen_recipe_items_item_idx).
-- Nothing else to add.
