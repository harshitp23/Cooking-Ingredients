import { test } from 'node:test';
import assert from 'node:assert';
import { loadApp } from './harness.mjs';
import { item, counted } from './helpers.mjs';

test('state cycles have -> low -> out -> have, in that order', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  assert.equal(K.nextState('have'), 'low');
  assert.equal(K.nextState('low'), 'out');
  assert.equal(K.nextState('out'), 'have');

  K._reset({ items: [item('a', 'Milk', { state: 'have' })] });
  K.cycleState('a');
  assert.equal(K.state.items[0].state, 'low');
  K.cycleState('a');
  assert.equal(K.state.items[0].state, 'out');
  K.cycleState('a');
  assert.equal(K.state.items[0].state, 'have');
});

test('adding an ingredient gives it sensible defaults, no qty, and queues one insert', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ items: [] });
  const row = K.addItem('ingredient', '  Olive oil  ', 'Pantry');
  assert.equal(row.name, 'Olive oil');
  assert.equal(row.kind, 'ingredient');
  assert.equal(row.state, 'have');
  assert.equal(row.category, 'Pantry');
  assert.equal(row.is_staple, false);
  assert.ok(!('qty' in row), 'ingredients never carry qty (keeps syncing pre-migration)');
  assert.equal(K.state.queue.length, 1);
  assert.equal(K.state.queue[0].table, 'kitchen_items');
  assert.equal(K.state.queue[0].kind, 'insert');
});

test('duplicate ingredient names are refused', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ items: [item('a', 'Milk')] });
  assert.equal(K.addItem('ingredient', 'milk'), null);
  assert.equal(K.state.items.length, 1);
});

test('snacks and equipment are counted; default count is 1', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ items: [] });
  const chips = K.addItem('snack', 'Chips', null, { qty: 2 });
  const pan = K.addItem('equipment', 'Frying pan');
  assert.equal(chips.kind, 'snack');
  assert.equal(chips.qty, 2);
  assert.equal(chips.category, null);
  assert.equal(pan.qty, 1);
  assert.equal(pan.state, 'have');
});

test('stepping a count up/down keeps state in sync and never goes below 0', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ items: [counted('p', 'Bowl', 'equipment', 1)] });
  K.stepCount('p', 1);
  assert.equal(K.state.items[0].qty, 2);
  K.stepCount('p', -1);
  K.stepCount('p', -1);
  assert.equal(K.state.items[0].qty, 0);
  assert.equal(K.state.items[0].state, 'out');
  K.stepCount('p', -1);
  assert.equal(K.state.items[0].qty, 0, 'clamped at 0');

  const upd = K.state.queue.filter((o) => o.kind === 'update' && o.id === 'p');
  assert.equal(upd.length, 1, 'taps coalesce into one update');
  assert.deepEqual({ ...upd[0].patch }, { qty: 0, state: 'out' });
});

test('adding a snack you already have bumps its count instead of duplicating', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ items: [counted('c', 'Chips', 'snack', 2)] });
  K.addItem('snack', 'chips', null, { qty: 3 });
  assert.equal(K.state.items.length, 1);
  assert.equal(K.state.items[0].qty, 5);
});

test('legacy equipment with no qty column reads its count from own/don\'t-own state', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  const own = item('a', 'Whisk', { kind: 'equipment', state: 'have' });
  const notOwn = item('b', 'Wok', { kind: 'equipment', state: 'out' });
  assert.equal(K.countOf(own), 1);
  assert.equal(K.countOf(notOwn), 0);

  K._reset({ items: [own, notOwn] });
  K.stepCount('b', 1);
  assert.equal(K.state.items.find((x) => x.id === 'b').qty, 1);
});

test('inventoryStats counts each section plus low/out ingredients', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  const s = K.inventoryStats([
    item('a', 'Milk', { state: 'low' }),
    item('b', 'Eggs', { state: 'out' }),
    item('c', 'Rice'),
    counted('d', 'Chips', 'snack', 0),
    counted('e', 'Pan', 'equipment', 1),
  ]);
  assert.deepEqual({ ...s }, { ingredients: 3, snacks: 1, equipment: 1, low: 1, out: 1 });
});

test('recategorize renames a category across all its ingredients, undoable', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({
    items: [
      item('a', 'Milk', { category: 'Fridge' }),
      item('b', 'Curd', { category: 'Fridge' }),
      item('c', 'Rice', { category: 'Pantry' }),
    ],
  });
  K.recategorize('Fridge', 'Dairy');
  assert.deepEqual(K.state.items.map((i) => i.category), ['Dairy', 'Dairy', 'Pantry']);

  window.document.querySelector('#toast .toast-undo').click();
  assert.deepEqual(K.state.items.map((i) => i.category), ['Fridge', 'Fridge', 'Pantry']);
});

test('removing a category keeps its items (they become uncategorized)', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ items: [item('a', 'Milk', { category: 'Fridge' })] });
  K.recategorize('Fridge', null);
  assert.equal(K.state.items.length, 1);
  assert.equal(K.state.items[0].category, null);
});
