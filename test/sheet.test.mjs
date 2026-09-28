import { test } from 'node:test';
import assert from 'node:assert';
import { loadApp } from './harness.mjs';
import { item, counted } from './helpers.mjs';

const $ = (w, s) => w.document.querySelector(s);

test('add sheet: ingredient with a category chip and "Out" status lands on the list', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ items: [item('a', 'Milk', { category: 'Dairy' })] });
  K.openSheet({ mode: 'add-item', section: 'ingredients' });
  $(window, '#sh-name').value = 'Curd';
  $(window, '[data-act="sheet-chip"][data-val="Dairy"]').click();
  assert.equal($(window, '#sh-cat').value, 'Dairy');
  $(window, '[data-act="sheet-state"][data-val="out"]').click();
  $(window, '[data-act="sheet-save"]').click();

  const curd = K.state.items.find((i) => i.name === 'Curd');
  assert.equal(curd.category, 'Dairy');
  assert.equal(curd.state, 'out');
  assert.deepEqual(K.state.shoppingItems.map((s) => s.name), ['Curd']);
  assert.ok($(window, '#sheet').hidden, 'sheet closed');
});

test('add sheet: Enter adds and keeps the sheet open for the next one', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ items: [] });
  K.openSheet({ mode: 'add-item', section: 'snacks' });
  $(window, '[data-act="sheet-count"][data-d="1"]').click(); // 1 -> 2
  const name = $(window, '#sh-name');
  name.value = 'Chips';
  name.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.equal(K.state.items[0].qty, 2);
  assert.equal(K.state.items[0].kind, 'snack');
  assert.equal($(window, '#sheet').hidden, false, 'still open');
  assert.equal($(window, '#sh-name').value, '');
});

test('edit sheet: changing count and notes saves both', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ items: [counted('p', 'Bowl', 'equipment', 1)] });
  K.openSheet({ mode: 'edit-item', id: 'p' });
  $(window, '[data-act="sheet-count"][data-d="1"]').click();
  $(window, '#sh-notes').value = 'Steel';
  $(window, '[data-act="sheet-save"]').click();
  assert.equal(K.state.items[0].qty, 2);
  assert.equal(K.state.items[0].notes, 'Steel');
});

test('inventory tab renders the chosen section', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ items: [item('a', 'Milk'), counted('c', 'Chips', 'snack', 2)] });
  $(window, '[data-invsec="snacks"]').click();
  const list = $(window, '#inv-list').textContent;
  assert.ok(list.includes('Chips'));
  assert.ok(!list.includes('Milk'));
});
