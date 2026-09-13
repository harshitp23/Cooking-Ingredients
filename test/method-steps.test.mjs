import { test } from 'node:test';
import assert from 'node:assert';
import { loadApp, clickUndo, clone } from './harness.mjs';
import { recipe } from './helpers.mjs';

test('addStep appends a line to the method', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ recipes: [recipe('r1', 'Toast')] });
  K.addStep('r1', 'Toast the bread');
  K.addStep('r1', 'Butter it');

  const r = K.state.recipes[0];
  assert.deepEqual(K.stepsOf(r), ['Toast the bread', 'Butter it']);
  assert.ok(K.state.queue.some((o) => o.table === 'kitchen_recipes' && o.kind === 'update'));
});

test('moveStep reorders two adjacent steps', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ recipes: [recipe('r1', 'Toast', { instructions: 'A\nB\nC' })] });
  K.moveStep('r1', 0, 1); // swap A and B
  assert.deepEqual(K.stepsOf(K.state.recipes[0]), ['B', 'A', 'C']);

  K.moveStep('r1', 0, -1); // already at top, no-op
  assert.deepEqual(K.stepsOf(K.state.recipes[0]), ['B', 'A', 'C']);
});

test('editStep changes one line only', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ recipes: [recipe('r1', 'Toast', { instructions: 'A\nB\nC' })] });
  K.editStep('r1', 1, 'B revised');
  assert.deepEqual(K.stepsOf(K.state.recipes[0]), ['A', 'B revised', 'C']);
});

test('removeStep deletes a line and can be undone', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ recipes: [recipe('r1', 'Toast', { instructions: 'A\nB\nC' })] });
  const before = clone(K.state.recipes);

  K.removeStep('r1', 1); // remove 'B'
  assert.deepEqual(K.stepsOf(K.state.recipes[0]), ['A', 'C']);

  clickUndo(window);
  assert.deepEqual(K.stepsOf(K.state.recipes[0]), ['A', 'B', 'C']);
  assert.deepEqual(clone(K.state.recipes), before, 'undo restores the exact prior row');
});
