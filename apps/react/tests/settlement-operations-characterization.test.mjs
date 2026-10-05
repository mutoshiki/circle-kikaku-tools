import test from 'node:test';
import assert from 'node:assert/strict';
import { createOperationsFixture, resultOf } from './helpers/settlement-operations-fixture.mjs';
import { collectionChange } from '../src/components/settlement/edit.js';

test('paid flags change collection counters, not calculated amounts or other domain state', async t => {
  const r = await createOperationsFixture(); t.after(r.dispose);
  const roomBefore = structuredClone(r.runtime.store.getSnapshot()), before = resultOf(r.runtime);
  collectionChange(r.runtime.store, { name: r.keys.collection.name, checked: true, collector: '  記録した名前  ' });
  collectionChange(r.runtime.store, { name: r.keys.payment.name, checked: true, payment: true });
  const after = resultOf(r.runtime), roomAfter = r.runtime.store.getSnapshot();
  for (const key of ['perPerson','shareCount','payerCount','totalSplit','totalClub','expectedCollected']) assert.equal(after[key], before[key], key);
  assert.deepEqual(after.cars, before.cars);
  assert.equal(after.paidCount, before.paidCount + 1);
  assert.deepEqual(roomAfter.participants, roomBefore.participants);
  assert.deepEqual(roomAfter.allocations, roomBefore.allocations);
  const state = r.runtime.store.domain.settlementInput(roomAfter).state;
  assert.equal(state.paidBy[r.keys.collection.name], '記録した名前');
  assert.equal(state.driverPaid[r.keys.payment.name], true);
  collectionChange(r.runtime.store, { name: r.keys.collection.name, checked: false });
  assert.equal(r.runtime.store.domain.settlementInput(r.runtime.store.getSnapshot()).state.paidBy[r.keys.collection.name], undefined);
  assert.equal(r.runtime.store.domain.settlementInput(r.runtime.store.getSnapshot()).state.driverPaid[r.keys.payment.name], true);
});

test('standalone collector fallback is trimmed by the unchanged React owner', async t => {
  const r = await createOperationsFixture({ standalone: true }); t.after(r.dispose);
  const name = r.keys.collection.name, before = resultOf(r.runtime);
  collectionChange(r.runtime.store, { name, checked: true, collector: '' || name });
  const state = r.runtime.store.domain.settlementInput(r.runtime.store.getSnapshot()).state;
  assert.equal(state.paidBy[name], name);
  assert.equal(resultOf(r.runtime).perPerson, before.perPerson);
});

test('manual history deduplicates, retains at most twenty and Undo is runtime-local', async t => {
  const r = await createOperationsFixture(); t.after(r.dispose);
  const store = r.runtime.store, history = r.runtime.history;
  assert.equal(history.read().length, 0);
  const first = history.save(store.getSnapshot());
  assert.equal(history.save(store.getSnapshot()).time, first.time);
  for (let i = 0; i < 22; i++) { store.command('rename', { name: `企画${i}` }); history.save(store.getSnapshot()); }
  assert.equal(history.read().length, 20);
  const before = structuredClone(store.getSnapshot()), generation = before.resetGeneration;
  assert.equal(history.restore(store, first), true);
  assert.equal(store.getSnapshot().resetGeneration, generation);
  assert.deepEqual(store.getSnapshot().participants, first.data.participants);
  assert.equal(history.canUndo(), true);
  assert.equal(history.undo(store), true);
  assert.equal(store.getSnapshot().roomName, before.roomName);
  assert.equal(history.canUndo(), false);
});
