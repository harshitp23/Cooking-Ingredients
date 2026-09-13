-- ============================================================================
-- Kitchen Inventory app — recipe categories (breakfast, lunch, dinner,
-- snacks, sauces, etc.)
-- Paste into the Supabase SQL editor and run once, after the Phase 2
-- migration.
--
-- Purely additive: one new nullable column on kitchen_recipes, same pattern
-- as kitchen_items.category. No existing column is altered. Safe to re-run.
-- ============================================================================

alter table public.kitchen_recipes
  add column if not exists category text;

-- Recipe list groups/filters by category client-side; no new index needed
-- at this scale (kitchen_recipes is one user's personal recipe box).
