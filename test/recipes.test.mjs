import { test } from 'node:test';
import assert from 'node:assert';
import { loadApp } from './harness.mjs';
import { item, recipe, line } from './helpers.mjs';

test('recipeStatus: low still counts as makeable; out does not; staples & equipment ignored', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  const items = [
    item('i1', 'Onion', { state: 'have' }),
    item('i2', 'Carrot', { state: 'low' }),
    item('i3', 'Salt', { state: 'out', is_staple: true }),   // staple -> ignored
    item('i4', 'Pot', { state: 'out', kind: 'equipment' }),  // equipment -> ignored
  ];
  const lines = items.map((it, n) => line('l' + n, 'r1', it.id, { sort_order: n }));
  const r = recipe('r1', 'Stew');

  let st = K.recipeStatus(r, lines, items);
  assert.equal(st.makeable, true);
  assert.deepEqual(st.low, ['Carrot']);
  assert.deepEqual(st.missing, []);

  items[0].state = 'out';
  st = K.recipeStatus(r, lines, items);
  assert.equal(st.makeable, false);
  assert.deepEqual(st.missing, ['Onion']);
});

test('adding a recipe ingredient not in inventory creates an "out" item on the shopping list', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ items: [], recipes: [recipe('r1', 'Toast')] });
  const res = K.addRecipeItem('r1', 'Sourdough', '2 slices');

  assert.ok(res && res.createdItem, 'reports it created a new item');
  const it = K.state.items.find((x) => x.name === 'Sourdough');
  assert.ok(it, 'item added to inventory');
  assert.equal(it.kind, 'ingredient');
  assert.equal(it.state, 'out');
  assert.ok(K.shopping().items.some((x) => x.name === 'Sourdough'), 'shows on shopping list');

  assert.equal(
    K.state.recipeItems.filter((l) => l.recipe_id === 'r1' && l.item_id === it.id).length,
    1,
    'recipe line links the new item',
  );
  assert.equal(K.state.recipeItems[0].display_qty, '2 slices');
  assert.ok(K.state.queue.some((o) => o.table === 'kitchen_items' && o.kind === 'insert'));
  assert.ok(K.state.queue.some((o) => o.table === 'kitchen_recipe_items' && o.kind === 'insert'));
  // the item insert must be queued before the line insert (FK order)
  const iIdx = K.state.queue.findIndex((o) => o.table === 'kitchen_items' && o.kind === 'insert');
  const lIdx = K.state.queue.findIndex((o) => o.table === 'kitchen_recipe_items' && o.kind === 'insert');
  assert.ok(iIdx < lIdx, 'item insert precedes recipe-line insert');
});

test('an existing inventory ingredient is reused case-insensitively, not duplicated', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ items: [item('i1', 'Milk', { state: 'have' })], recipes: [recipe('r1', 'Latte')] });
  const res = K.addRecipeItem('r1', 'milk', '200 ml');

  assert.equal(res.createdItem, false);
  assert.equal(res.item.id, 'i1');
  assert.equal(K.state.items.length, 1, 'no duplicate inventory row');
  assert.equal(K.state.items[0].state, 'have', 'existing item state untouched');
});

test('adding the same ingredient twice to one recipe is a no-op the second time', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ items: [item('i1', 'Milk')], recipes: [recipe('r1', 'Latte')] });
  K.addRecipeItem('r1', 'Milk', '100ml');
  const second = K.addRecipeItem('r1', 'milk', '999ml');
  assert.equal(second, null);
  assert.equal(K.state.recipeItems.filter((l) => l.recipe_id === 'r1').length, 1);
});

test('"can make now" filter shows only makeable recipes, sorted', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({
    items: [item('i1', 'Egg', { state: 'have' }), item('i2', 'Flour', { state: 'out' })],
    recipes: [recipe('r1', 'Boiled egg'), recipe('r2', 'Bread')],
    recipeItems: [line('l1', 'r1', 'i1'), line('l2', 'r2', 'i2')],
  });

  assert.deepEqual(K.cookList('all').map((r) => r.name), ['Boiled egg', 'Bread']);
  assert.deepEqual(K.cookList('makeable').map((r) => r.name), ['Boiled egg']);
});

test('deleting an ingredient used by a recipe removes the line and both can be undone', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({
    items: [item('i1', 'Butter', { state: 'have' })],
    recipes: [recipe('r1', 'Cookies'), recipe('r2', 'Toast')],
    recipeItems: [line('l1', 'r1', 'i1'), line('l2', 'r2', 'i1')],
  });

  K.deleteItem('i1');
  assert.equal(K.state.items.length, 0);
  assert.equal(K.state.recipeItems.length, 0, 'both referencing lines removed');
  // recipe-line deletes must precede the item delete (FK restrict)
  const lineDeletes = K.state.queue.filter((o) => o.table === 'kitchen_recipe_items' && o.kind === 'delete');
  const itemDelete = K.state.queue.findIndex((o) => o.table === 'kitchen_items' && o.kind === 'delete');
  assert.equal(lineDeletes.length, 2);
  assert.ok(K.state.queue.indexOf(lineDeletes[1]) < itemDelete, 'line deletes queued before item delete');

  window.document.querySelector('#toast .toast-undo').click();
  assert.equal(K.state.items.length, 1);
  assert.equal(K.state.recipeItems.length, 2);
});

test('recipe method round-trips through editRecipe', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ recipes: [recipe('r1', 'Omelette')] });
  K.editRecipe('r1', { instructions: 'Beat eggs\nHeat pan\nCook 2 min', servings: 2 });

  const r = K.state.recipes[0];
  assert.equal(r.servings, 2);
  assert.deepEqual(r.instructions.split('\n'), ['Beat eggs', 'Heat pan', 'Cook 2 min']);
  assert.ok(K.state.queue.some((o) => o.table === 'kitchen_recipes' && o.kind === 'update'));
});
