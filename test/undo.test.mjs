import { test } from 'node:test';
import assert from 'node:assert';
import { loadApp, clickUndo, clone, byId } from './harness.mjs';
import { item, recipe, line } from './helpers.mjs';

test('undo restores exact prior state after a state change', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ items: [item('a', 'Milk', { state: 'out', updated_at: '2026-02-02T00:00:00.000Z' })] });
  const before = clone(K.state.items);

  K.cycleState('a'); // out -> have, updated_at bumped
  assert.notDeepEqual(clone(K.state.items), before);

  clickUndo(window);
  assert.deepEqual(clone(K.state.items), before, 'value AND updated_at restored');
});

test('undo restores exact prior state after a delete (item + its recipe lines)', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({
    items: [item('a', 'Milk', { state: 'have' }), item('b', 'Eggs', { state: 'low' })],
    recipes: [recipe('r1', 'Pancakes')],
    recipeItems: [line('l1', 'r1', 'a', { display_qty: '1 cup', sort_order: 2 })],
  });
  const beforeItems = byId(K.state.items);
  const beforeLines = byId(K.state.recipeItems);

  K.deleteItem('a');
  assert.equal(K.state.items.length, 1);
  assert.equal(K.state.recipeItems.length, 0, 'referencing recipe line removed too');

  clickUndo(window);
  assert.deepEqual(byId(K.state.items), beforeItems);
  assert.deepEqual(byId(K.state.recipeItems), beforeLines);
});

test('undo restores exact prior state after an edit', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ items: [item('a', 'Milk', { category: 'Fridge', updated_at: '2026-03-03T00:00:00.000Z' })] });
  const before = clone(K.state.items);

  K.editItem('a', { category: 'Door', is_staple: true }, 'Saved');
  assert.notDeepEqual(clone(K.state.items), before);

  clickUndo(window);
  assert.deepEqual(clone(K.state.items), before);
});

test('undo restores a deleted recipe and its lines', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({
    items: [item('a', 'Flour', { state: 'have' })],
    recipes: [recipe('r1', 'Bread')],
    recipeItems: [line('l1', 'r1', 'a')],
  });
  const beforeRecipes = byId(K.state.recipes);
  const beforeLines = byId(K.state.recipeItems);

  K.deleteRecipe('r1');
  assert.equal(K.state.recipes.length, 0);
  assert.equal(K.state.recipeItems.length, 0);

  clickUndo(window);
  assert.deepEqual(byId(K.state.recipes), beforeRecipes);
  assert.deepEqual(byId(K.state.recipeItems), beforeLines);
});
