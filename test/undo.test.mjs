import { test } from 'node:test';
import assert from 'node:assert';
import { loadApp, clickUndo, clone, byId } from './harness.mjs';
import { item } from './helpers.mjs';

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

test('undo restores exact prior state after a delete', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ items: [item('a', 'Milk', { state: 'have' }), item('b', 'Eggs', { state: 'low' })] });
  const before = byId(K.state.items);

  K.deleteItem('a');
  assert.equal(K.state.items.length, 1);

  clickUndo(window);
  assert.deepEqual(byId(K.state.items), before);
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
