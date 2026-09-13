import { test } from 'node:test';
import assert from 'node:assert';
import { loadApp } from './harness.mjs';
import { recipe, item, line } from './helpers.mjs';

test('new recipes default to no category (Uncategorized)', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ recipes: [] });
  const r = K.addRecipe('Pancakes');
  assert.equal(r.category, null);

  const grouped = K.groupRecipeRows(K.cookList('all'));
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].name, 'Uncategorized');
});

test('groupRecipeRows groups by category, Uncategorized sorted last', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({
    recipes: [
      recipe('r1', 'Pancakes', { category: 'Breakfast' }),
      recipe('r2', 'Omelette', { category: 'Breakfast' }),
      recipe('r3', 'Ketchup', { category: 'Sauces' }),
      recipe('r4', 'Mystery dish', { category: null }),
    ],
  });

  const grouped = K.groupRecipeRows(K.cookList('all'));
  assert.deepEqual(grouped.map((g) => g.name), ['Breakfast', 'Sauces', 'Uncategorized']);
  assert.deepEqual(grouped[0].rows.map((r) => r.name).sort(), ['Omelette', 'Pancakes']);
  assert.deepEqual(grouped[2].rows.map((r) => r.name), ['Mystery dish']);
});

test('editing a recipe category moves it between groups and can be undone', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ recipes: [recipe('r1', 'Chili', { category: 'Dinner' })] });
  K.editRecipe('r1', { category: 'Lunch' }, 'Saved');

  let grouped = K.groupRecipeRows(K.cookList('all'));
  assert.deepEqual(grouped.map((g) => g.name), ['Lunch']);

  window.document.querySelector('#toast .toast-undo').click();
  grouped = K.groupRecipeRows(K.cookList('all'));
  assert.deepEqual(grouped.map((g) => g.name), ['Dinner']);
});

test('"can make now" filter still applies within categories', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({
    items: [item('i1', 'Egg', { state: 'have' }), item('i2', 'Flour', { state: 'out' })],
    recipes: [recipe('r1', 'Boiled egg', { category: 'Breakfast' }), recipe('r2', 'Bread', { category: 'Breakfast' })],
    recipeItems: [line('l1', 'r1', 'i1'), line('l2', 'r2', 'i2')],
  });

  const grouped = K.groupRecipeRows(K.cookList('makeable'));
  assert.equal(grouped.length, 1);
  assert.deepEqual(grouped[0].rows.map((r) => r.name), ['Boiled egg']);
});
