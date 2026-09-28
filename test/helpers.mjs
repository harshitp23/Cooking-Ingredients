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

// A counted row (snack / equipment). Pass `qty: undefined` via `over` to
// simulate a row fetched before the qty migration ran.
export const counted = (id, name, kind, qty, over = {}) =>
  item(id, name, { kind, qty, state: qty > 0 ? 'have' : 'out', ...over });

export const shopCat = (id, name, over = {}) => ({
  id,
  user_id: 'u1',
  name,
  sort_order: 1,
  created_at: '2026-01-01T00:00:00.000Z',
  ...over,
});

export const shopItem = (id, categoryId, name, over = {}) => ({
  id,
  user_id: 'u1',
  category_id: categoryId,
  name,
  qty: null,
  checked: false,
  sort_order: 1,
  created_at: '2026-01-01T00:00:00.000Z',
  ...over,
});
