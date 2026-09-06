import { test } from 'node:test';
import assert from 'node:assert';
import { loadApp, makeStorage } from './harness.mjs';
import { item } from './helpers.mjs';

test('shopping list: out items sort above low items', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({
    items: [
      item('a', 'Apples', { state: 'low' }),
      item('b', 'Butter', { state: 'out' }),
      item('c', 'Cream', { state: 'low' }),
      item('d', 'Dill', { state: 'out' }),
    ],
  });
  assert.deepEqual(K.shopping().items.map((x) => x.name), ['Butter', 'Dill', 'Apples', 'Cream']);
});

test('checking off a shopping item sets state to have and removes it from the list', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ items: [item('a', 'Milk', { state: 'out' }), item('b', 'Eggs', { state: 'low' })] });
  assert.deepEqual(K.shopping().items.map((x) => x.name), ['Milk', 'Eggs']);

  K.checkOff('a');
  assert.equal(K.state.items.find((x) => x.id === 'a').state, 'have');
  assert.deepEqual(K.shopping().items.map((x) => x.name), ['Eggs']);
});

test('one-off items persist across reload and never create kitchen_items rows', async (t) => {
  const storage = makeStorage();

  const first = await loadApp({ storage });
  first.K._reset({ items: [] });
  first.K.addOneoff('Birthday candles');
  assert.equal(first.K.shopping().oneoffs[0].name, 'Birthday candles');
  assert.equal(first.K.state.items.length, 0, 'no inventory row created');
  assert.equal(
    first.K.state.queue.filter((o) => o.table === 'kitchen_items').length,
    0,
    'no kitchen_items write queued',
  );
  first.window.close();

  // Reload: brand new app instance, same localStorage.
  const second = await loadApp({ storage });
  t.after(() => second.window.close());
  const oneoffs = second.K.shopping().oneoffs;
  assert.equal(oneoffs.length, 1);
  assert.equal(oneoffs[0].name, 'Birthday candles');
  assert.equal(second.K.state.oneoffs[0].done, false);
  assert.equal(second.K.state.items.length, 0);
});

test('checked-off one-off can be undone', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ items: [] });
  const o = K.addOneoff('Foil');
  K.checkOffOneoff(o.id);
  assert.equal(K.shopping().oneoffs.length, 0);

  window.document.querySelector('#toast .toast-undo').click();
  assert.deepEqual(K.shopping().oneoffs.map((x) => x.name), ['Foil']);
});
