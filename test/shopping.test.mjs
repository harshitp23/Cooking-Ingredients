import { test } from 'node:test';
import assert from 'node:assert';
import { loadApp, clickUndo } from './harness.mjs';
import { item, counted, shopCat, shopItem } from './helpers.mjs';

const names = (K) => K.state.shoppingItems.map((s) => s.name).sort();

test('an ingredient running out lands on the list, under a category named like its own', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ items: [item('a', 'Milk', { state: 'low', category: 'Dairy' })] });
  K.cycleState('a'); // low -> out
  assert.deepEqual(names(K), ['Milk']);
  assert.equal(K.state.shoppingCategories.length, 1);
  assert.equal(K.state.shoppingCategories[0].name, 'Dairy');
  assert.equal(K.state.shoppingItems[0].category_id, K.state.shoppingCategories[0].id);
});

test('reuses an existing shopping category (case-insensitive) and uses "Other" when uncategorized', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({
    items: [item('a', 'Milk', { state: 'low', category: 'dairy' }), item('b', 'Salt', { state: 'low' })],
    shoppingCategories: [shopCat('c1', 'Dairy')],
  });
  K.cycleState('a');
  K.cycleState('b');
  const cats = K.state.shoppingCategories.map((c) => c.name).sort();
  assert.deepEqual(cats, ['Dairy', 'Other']);
  assert.equal(K.state.shoppingItems.find((s) => s.name === 'Milk').category_id, 'c1');
});

test('no duplicate if it is already on the list; a checked copy is un-ticked instead', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({
    items: [item('a', 'Milk', { state: 'low' }), item('b', 'Eggs', { state: 'low' })],
    shoppingCategories: [shopCat('c1', 'Groceries')],
    shoppingItems: [shopItem('s1', 'c1', 'milk'), shopItem('s2', 'c1', 'Eggs', { checked: true })],
  });
  K.cycleState('a');
  K.cycleState('b');
  assert.equal(K.state.shoppingItems.length, 2);
  assert.equal(K.state.shoppingItems.find((s) => s.id === 's2').checked, false);
});

test('back in stock takes it off the list (only while unchecked)', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ items: [item('a', 'Milk', { state: 'low' })] });
  K.cycleState('a'); // -> out, added
  assert.deepEqual(names(K), ['Milk']);
  K.cycleState('a'); // -> have, removed
  assert.deepEqual(names(K), []);
});

test('undoing the state change also undoes the list change', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ items: [item('a', 'Milk', { state: 'low' })] });
  K.cycleState('a');
  assert.deepEqual(names(K), ['Milk']);
  clickUndo(window);
  assert.equal(K.state.items[0].state, 'low');
  assert.deepEqual(names(K), []);
});

test('staples never auto-add', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ items: [item('a', 'Salt', { state: 'low', is_staple: true })] });
  K.cycleState('a');
  assert.equal(K.state.items[0].state, 'out');
  assert.deepEqual(names(K), []);
});

test('a snack hitting 0 lands on the list under Snacks; equipment at 0 does not', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ items: [counted('c', 'Chips', 'snack', 1), counted('p', 'Pan', 'equipment', 1)] });
  K.stepCount('c', -1);
  K.stepCount('p', -1);
  assert.deepEqual(names(K), ['Chips']);
  assert.equal(K.state.shoppingCategories[0].name, 'Snacks');

  K.stepCount('c', 1);
  assert.deepEqual(names(K), [], 'back above 0 takes it off again');
});

test('ticking an item off restocks the matching ingredient; one undo reverts both', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ items: [item('a', 'Milk', { state: 'low' })] });
  K.cycleState('a'); // -> out, on list
  const s = K.state.shoppingItems[0];

  K.toggleShoppingItem(s.id);
  assert.equal(K.state.shoppingItems[0].checked, true);
  assert.equal(K.state.items[0].state, 'have', 'bought -> in stock');
  assert.equal(K.state.shoppingItems.length, 1, 'ticked item stays on the list until cleared');

  clickUndo(window);
  assert.equal(K.state.shoppingItems[0].checked, false);
  assert.equal(K.state.items[0].state, 'out');
});

test('ticking off a snack at 0 sets it back to 1', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ items: [counted('c', 'Chips', 'snack', 1)] });
  K.stepCount('c', -1);
  K.toggleShoppingItem(K.state.shoppingItems[0].id);
  assert.equal(K.state.items[0].qty, 1);
  assert.equal(K.state.items[0].state, 'have');
});

test('manually added list items never touch inventory', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ items: [item('a', 'Milk')], shoppingCategories: [shopCat('c1', 'Dairy')] });
  K.addShoppingItem('c1', 'Milk', '2 L');
  assert.equal(K.state.items[0].state, 'have');
  assert.equal(K.state.shoppingItems[0].qty, '2 L');
});

test('groupShoppingItems: checked items sink within their category', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  const g = K.groupShoppingItems(
    [shopCat('c1', 'Produce')],
    [shopItem('1', 'c1', 'Apples', { checked: true }), shopItem('2', 'c1', 'Bananas')],
  );
  assert.deepEqual(g[0].items.map((i) => i.name), ['Bananas', 'Apples']);
});

test('clear checked removes only ticked items and can be undone', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({
    shoppingCategories: [shopCat('c1', 'Produce')],
    shoppingItems: [shopItem('1', 'c1', 'Apples', { checked: true }), shopItem('2', 'c1', 'Bananas')],
  });
  K.clearCheckedShopping();
  assert.deepEqual(names(K), ['Bananas']);
  clickUndo(window);
  assert.deepEqual(names(K), ['Apples', 'Bananas']);
});
