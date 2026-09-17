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
    item('i4', 'Pot', { state: 'out', kind: 'equipment' }),  // equipment -> ignored (not an ingredient)
  ];
  const lines = items.map((it, n) => line('l' + n, 'r1', it.name, { sort_order: n }));
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

test('an ingredient with no matching inventory item is assumed present (not tracked, doesn\'t block "makeable")', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  const r = recipe('r1', 'Toast');
  const lines = [line('l1', 'r1', 'Sourdough')]; // no matching inventory item at all
  const st = K.recipeStatus(r, lines, []);
  assert.equal(st.makeable, true);
  assert.deepEqual(st.missing, []);
});

test('adding a recipe ingredient never touches inventory — it is plain text on the line', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ items: [], recipes: [recipe('r1', 'Toast')] });
  const res = K.addRecipeItem('r1', 'Sourdough', '2 slices');

  assert.ok(res && res.line, 'returns the created line');
  assert.equal(K.state.items.length, 0, 'no inventory row created');
  assert.equal(K.state.recipeItems.length, 1);
  assert.equal(K.state.recipeItems[0].name, 'Sourdough');
  assert.equal(K.state.recipeItems[0].item_id, null, 'no link to any item');
  assert.equal(K.state.recipeItems[0].display_qty, '2 slices');

  // only the recipe_items insert is queued — never a kitchen_items write
  assert.ok(K.state.queue.some((o) => o.table === 'kitchen_recipe_items' && o.kind === 'insert'));
  assert.ok(!K.state.queue.some((o) => o.table === 'kitchen_items'), 'kitchen_items untouched');
});

test('a recipe ingredient whose name matches inventory picks up its live state', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ items: [item('i1', 'Milk', { state: 'low' })], recipes: [recipe('r1', 'Latte')] });
  K.addRecipeItem('r1', 'milk', '200 ml'); // case-insensitive match

  assert.equal(K.state.items.length, 1, 'still no duplicate/new inventory row');
  const match = K.findInventoryMatch(K.state.items, K.state.recipeItems[0].name);
  assert.ok(match, 'matched live by name');
  assert.equal(match.id, 'i1');
  assert.equal(match.state, 'low');

  // and it reflects a LATER inventory change with no re-linking needed
  K.state.items[0].state = 'out';
  const st = K.recipeStatus(K.state.recipes[0], K.state.recipeItems, K.state.items);
  assert.deepEqual(st.missing, ['Milk']);
});

test('adding the same ingredient twice to one recipe is a no-op the second time', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ recipes: [recipe('r1', 'Latte')] });
  K.addRecipeItem('r1', 'Milk', '100ml');
  const second = K.addRecipeItem('r1', 'milk', '999ml'); // case-insensitive dup
  assert.equal(second, null);
  assert.equal(K.state.recipeItems.filter((l) => l.recipe_id === 'r1').length, 1);
});

test('"can make now" filter shows only makeable recipes, sorted', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({
    items: [item('i1', 'Egg', { state: 'have' }), item('i2', 'Flour', { state: 'out' })],
    recipes: [recipe('r1', 'Boiled egg'), recipe('r2', 'Bread')],
    recipeItems: [line('l1', 'r1', 'Egg'), line('l2', 'r2', 'Flour')],
  });

  assert.deepEqual(K.cookList('all').map((r) => r.name), ['Boiled egg', 'Bread']);
  assert.deepEqual(K.cookList('makeable').map((r) => r.name), ['Boiled egg']);
});

test('deleting an inventory item cleans up any legacy-linked recipe lines, and can be undone', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  // item_id links are legacy (pre-name-matching) but deleteItem must still
  // cascade them safely if they exist, same as before.
  K._reset({
    items: [item('i1', 'Butter', { state: 'have' })],
    recipes: [recipe('r1', 'Cookies'), recipe('r2', 'Toast')],
    recipeItems: [
      line('l1', 'r1', 'Butter', { item_id: 'i1' }),
      line('l2', 'r2', 'Butter', { item_id: 'i1' }),
    ],
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
