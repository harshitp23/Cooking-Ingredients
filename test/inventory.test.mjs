import { test } from 'node:test';
import assert from 'node:assert';
import { loadApp } from './harness.mjs';
import { item } from './helpers.mjs';

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

test('staples never appear in the shopping list, regardless of state', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  for (const st of ['have', 'low', 'out']) {
    K._reset({ items: [item('s', 'Salt', { is_staple: true, state: st })] });
    assert.equal(K.shopping().items.length, 0, `staple in state ${st} must not be listed`);
  }
});

test('equipment never appears in the shopping list, regardless of state', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  for (const st of ['have', 'low', 'out']) {
    K._reset({ items: [item('e', 'Blender', { kind: 'equipment', state: st })] });
    assert.equal(K.shopping().items.length, 0, `equipment in state ${st} must not be listed`);
  }
});

test('equipment toggles between own (have) and not-own (out)', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ items: [item('e', 'Whisk', { kind: 'equipment', state: 'have' })] });
  K.toggleEquipment('e');
  assert.equal(K.state.items[0].state, 'out');
  K.toggleEquipment('e');
  assert.equal(K.state.items[0].state, 'have');
});

test('adding an item gives it sensible defaults and queues one insert', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ items: [] });
  const row = K.addItem('ingredient', '  Olive oil  ');
  assert.equal(row.name, 'Olive oil');
  assert.equal(row.kind, 'ingredient');
  assert.equal(row.state, 'have');
  assert.equal(row.is_staple, false);
  assert.equal(K.state.queue.length, 1);
  assert.equal(K.state.queue[0].table, 'kitchen_items');
  assert.equal(K.state.queue[0].kind, 'insert');
});
