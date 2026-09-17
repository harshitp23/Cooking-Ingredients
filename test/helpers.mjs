// Shared row builders for tests.
export const item = (id, name, over = {}) => ({
  id,
  user_id: 'u1',
  name,
  kind: 'ingredient',
  state: 'have',
  category: null,
  is_staple: false,
  notes: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...over,
});

export const recipe = (id, name, over = {}) => ({
  id,
  user_id: 'u1',
  name,
  notes: null,
  instructions: null,
  servings: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...over,
});

// Recipe ingredient line. `name` is free text matched live against inventory
// item names (see findInventoryMatch) — item_id is legacy/unused by new code,
// only set via `over` when a test specifically wants to exercise that path
// (e.g. deleteItem's cascade cleanup for old linked rows).
export const line = (id, recipeId, name, over = {}) => ({
  id,
  user_id: 'u1',
  recipe_id: recipeId,
  item_id: null,
  name,
  display_qty: null,
  sort_order: 1,
  created_at: '2026-01-01T00:00:00.000Z',
  ...over,
});
