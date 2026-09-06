import { test } from 'node:test';
import assert from 'node:assert';
import { loadApp, makeDb, makeClient, applyToDb } from './harness.mjs';
import { item } from './helpers.mjs';

test('write queue flushes in order and is idempotent under partial failure', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  const db = makeDb();
  const rows = ['1', '2', '3'].map((n) => item(n, 'Item ' + n, { state: 'out' }));
  K._reset({
    items: rows,
    queue: rows.map((r) => ({ opId: r.id, table: 'kitchen_items', kind: 'insert', row: r })),
  });

  const order = [];
  let failedOnce = false;
  const send = async (op) => {
    order.push(op.opId);
    applyToDb(db, op); // the server DOES apply it...
    if (op.opId === '2' && !failedOnce) {
      failedOnce = true;
      throw new Error('ack lost'); // ...but the acknowledgement is lost
    }
  };

  await K.flush(send);
  assert.deepEqual(order, ['1', '2'], 'flush stops at the first failure');
  assert.equal(db.kitchen_items.length, 2, 'ops 1 and 2 reached the server');
  assert.deepEqual(K.state.queue.map((o) => o.opId), ['2', '3'], 'op 1 acked; 2 and 3 still queued');

  await K.flush(send);
  assert.deepEqual(order, ['1', '2', '2', '3'], 'resumes from op 2, in order');
  assert.equal(db.kitchen_items.length, 3, 'op 2 re-sent but NOT double-applied');
  assert.equal(K.state.queue.length, 0, 'queue fully drained');
});

test('coalescing keeps the queue idempotent for repeated taps', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ items: [item('a', 'Milk', { state: 'have' })] });
  K.cycleState('a'); // have -> low
  K.cycleState('a'); // low -> out
  K.cycleState('a'); // out -> have

  const updates = K.state.queue.filter((o) => o.id === 'a' && o.kind === 'update');
  assert.equal(updates.length, 1, 'three taps collapse to one pending update');
  assert.equal(updates[0].patch.state, 'have', 'final value wins');
});

test('reconcile merges still-pending local writes on top of server truth', async (t) => {
  const db = makeDb({ kitchen_items: [item('a', 'Milk', { state: 'have' })] });
  const client = makeClient(db);
  const { K, window } = await loadApp({ client });
  t.after(() => window.close());

  K.state.online = false;
  K.cycleState('a'); // -> low, queued but not sent (offline)
  assert.equal(K.state.queue.length, 1);

  K.state.online = true;
  await K.reconcile();

  assert.equal(K.state.items.find((x) => x.id === 'a').state, 'low', 'local change survived reconcile');
  assert.equal(db.kitchen_items[0].state, 'low', 'and reached the server');
  assert.equal(K.state.queue.length, 0);
});

test('create-then-delete while offline sends nothing to the server', async (t) => {
  const { K, window } = await loadApp();
  t.after(() => window.close());

  K._reset({ items: [] });
  const row = K.addItem('ingredient', 'Transient');
  K.deleteItem(row.id);
  assert.equal(K.state.queue.length, 0, 'insert + delete cancel out');
});
