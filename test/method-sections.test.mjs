import { test } from 'node:test';
import assert from 'node:assert';
import { loadApp, clickUndo, clone } from './harness.mjs';
import { recipe } from './helpers.mjs';

test('sectionsOf returns [] for a recipe with no instructions', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());
  assert.deepEqual(K.sectionsOf(recipe('r1', 'Toast')), []);
});

test('sectionsOf parses legacy flat newline instructions as one unnamed section', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  const r = recipe('r1', 'Toast', { instructions: 'Toast the bread\nButter it' });
  const sections = K.sectionsOf(r);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].name, null);
  assert.deepEqual(sections[0].steps, ['Toast the bread', 'Butter it']);
});

test('addMethodStep(recipe, null, text) lazily creates the first section', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ recipes: [recipe('r1', 'Toast')] });
  K.addMethodStep('r1', null, 'Toast the bread');
  K.addMethodStep('r1', null, 'Butter it');

  const sections = K.sectionsOf(K.state.recipes[0]);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].name, null);
  assert.deepEqual(sections[0].steps, ['Toast the bread', 'Butter it']);
});

test('addMethodSection creates a second, named section alongside the default one', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ recipes: [recipe('r1', 'Butter chicken')] });
  K.addMethodStep('r1', null, 'Mix yogurt and spices');
  const gravy = K.addMethodSection('r1', 'Gravy');
  K.addMethodStep('r1', gravy.id, 'Saute onions');

  const sections = K.sectionsOf(K.state.recipes[0]);
  assert.equal(sections.length, 2);
  assert.equal(sections[0].name, null);
  assert.deepEqual(sections[0].steps, ['Mix yogurt and spices']);
  assert.equal(sections[1].name, 'Gravy');
  assert.deepEqual(sections[1].steps, ['Saute onions']);
});

test('editMethodStep changes one step in one section only', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ recipes: [recipe('r1', 'Toast')] });
  const marination = K.addMethodSection('r1', 'Marination');
  const gravy = K.addMethodSection('r1', 'Gravy');
  K.addMethodStep('r1', marination.id, 'Mix yogurt');
  K.addMethodStep('r1', gravy.id, 'Saute onions');

  K.editMethodStep('r1', marination.id, 0, 'Mix yogurt and spices');

  const sections = K.sectionsOf(K.state.recipes[0]);
  assert.deepEqual(sections[0].steps, ['Mix yogurt and spices']);
  assert.deepEqual(sections[1].steps, ['Saute onions'], 'other section untouched');
});

test('moveMethodStep reorders within a section without affecting other sections', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ recipes: [recipe('r1', 'Toast')] });
  K.addMethodStep('r1', null, 'A');
  K.addMethodStep('r1', null, 'B');
  K.addMethodStep('r1', null, 'C');
  const other = K.addMethodSection('r1', 'Other');
  K.addMethodStep('r1', other.id, 'X');

  const sectionId = K.sectionsOf(K.state.recipes[0])[0].id;
  K.moveMethodStep('r1', sectionId, 0, 1); // swap A and B

  const sections = K.sectionsOf(K.state.recipes[0]);
  assert.deepEqual(sections[0].steps, ['B', 'A', 'C']);
  assert.deepEqual(sections[1].steps, ['X']);
});

test('removeMethodStep deletes a step and can be undone', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ recipes: [recipe('r1', 'Toast')] });
  K.addMethodStep('r1', null, 'A');
  K.addMethodStep('r1', null, 'B');
  K.addMethodStep('r1', null, 'C');
  const before = clone(K.state.recipes);
  const sectionId = K.sectionsOf(K.state.recipes[0])[0].id;

  K.removeMethodStep('r1', sectionId, 1); // remove 'B'
  assert.deepEqual(K.sectionsOf(K.state.recipes[0])[0].steps, ['A', 'C']);

  clickUndo(window);
  assert.deepEqual(K.sectionsOf(K.state.recipes[0])[0].steps, ['A', 'B', 'C']);
  assert.deepEqual(clone(K.state.recipes), before, 'undo restores the exact prior row');
});

test('removeMethodSection deletes a whole section and can be undone', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ recipes: [recipe('r1', 'Butter chicken')] });
  K.addMethodStep('r1', null, 'Mix yogurt');
  const gravy = K.addMethodSection('r1', 'Gravy');
  K.addMethodStep('r1', gravy.id, 'Saute onions');
  const before = clone(K.state.recipes);

  K.removeMethodSection('r1', gravy.id);
  assert.equal(K.sectionsOf(K.state.recipes[0]).length, 1);

  clickUndo(window);
  assert.equal(K.sectionsOf(K.state.recipes[0]).length, 2);
  assert.deepEqual(clone(K.state.recipes), before);
});

test('moveMethodSection reorders sections relative to each other', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ recipes: [recipe('r1', 'Butter chicken')] });
  const marination = K.addMethodSection('r1', 'Marination');
  const gravy = K.addMethodSection('r1', 'Gravy');
  assert.deepEqual(K.sectionsOf(K.state.recipes[0]).map((s) => s.name), ['Marination', 'Gravy']);

  K.moveMethodSection('r1', 0, 1);
  assert.deepEqual(K.sectionsOf(K.state.recipes[0]).map((s) => s.name), ['Gravy', 'Marination']);
});

test('renameMethodSection updates the name and can be undone', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ recipes: [recipe('r1', 'Toast')] });
  K.addMethodStep('r1', null, 'A');
  const sectionId = K.sectionsOf(K.state.recipes[0])[0].id;

  K.renameMethodSection('r1', sectionId, 'Marination');
  assert.equal(K.sectionsOf(K.state.recipes[0])[0].name, 'Marination');

  clickUndo(window);
  assert.equal(K.sectionsOf(K.state.recipes[0])[0].name, null);
});

test('computeDropIndex: dragging a row past another crosses its center', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  // Three 50px-tall rows stacked at 0, 50, 100.
  const tops = [0, 50, 100];
  const heights = [50, 50, 50];

  // Dragging row 0 down so its center sits at 90 (past row 1's center at 75,
  // not yet past row 2's center at 125) should land at index 1.
  assert.equal(K.computeDropIndex(tops, heights, 0, 90), 1);

  // Barely moved: still index 0.
  assert.equal(K.computeDropIndex(tops, heights, 0, 20), 0);

  // Dragging row 2 up past both others' centers: index 0.
  assert.equal(K.computeDropIndex(tops, heights, 2, 10), 0);
});
