import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomStore } from '../src/store/room-store.js';
import { createRoomSync } from '../src/sync/room-sync.js';
import { createFixtureServer, memoryStorage } from './helpers/fixture-transport.mjs';
import { allocationSaveReceipt, settleAllocationSave } from '../src/ui/allocation-save.js';
import { createParticipantTaskDraft } from '../src/ui/participant-task-draft.js';

async function client() {
  let tick = Date.now(), randomCalls = 0;
  const clock = { now: () => ++tick, isServerAligned: () => true };
  const store = createRoomStore({ clock, random: () => { randomCalls++; return 0.25; } });
  store.command('addParticipants', { people: [{ name: 'A', driver: true }, { name: 'B' }, { name: 'C' }] });
  const server = createFixtureServer(store.getSnapshot()), transport = server.connect(), storage = memoryStorage();
  const sync = createRoomSync({ store, storage, transport, clientId: 'allocation-receipt', clock, legacyLoadWrites: false });
  sync.start(); await Promise.resolve();
  return { store, server, transport, storage, sync, randomCalls: () => randomCalls };
}
function command(runtime, name, args) {
  return allocationSaveReceipt(runtime, runtime.store.command(name, args), { type: 'car', label: '割り当てを保存' });
}

test('rejected random save retries the applied payload without invoking another shuffle', async () => {
  const runtime = await client();
  try {
    runtime.transport.failOnce(new Error('permission denied'));
    const original = command(runtime, 'randomize', { type: 'car' });
    assert.equal(Object.hasOwn(original, 'base'), false);
    assert.equal(Object.hasOwn(original, 'local'), false);
    const randomCalls = runtime.randomCalls();
    const failed = await settleAllocationSave(runtime, original);
    assert.equal(failed.disposition, 'failed');
    assert.equal(failed.receipt.canRetry, true);
    const retried = await settleAllocationSave(runtime, JSON.parse(JSON.stringify(failed.receipt)), { retry: true });
    assert.equal(retried.disposition, 'saved');
    assert.equal(runtime.randomCalls(), randomCalls);
    assert.deepEqual(runtime.server.get().allocations.car.placements, runtime.store.getSnapshot().allocations.car.placements);
  } finally { runtime.sync.dispose(); }
});

test('group creation retry retains group identity and unrelated acknowledged edits', async () => {
  const runtime = await client();
  try {
    const ownerId = Object.values(runtime.store.getSnapshot().participants).find(p => p.name === 'B').id;
    runtime.transport.failOnce(new Error('permission denied'));
    const failed = await settleAllocationSave(runtime, command(runtime, 'createGroup', { type: 'car', ownerId, capacity: 3 }));
    const groupId = runtime.store.getSnapshot().allocations.car.placements[ownerId].groupId;
    runtime.store.command('rename', { name: '別の保存' }); await runtime.sync.flush();
    const retried = await settleAllocationSave(runtime, failed.receipt, { retry: true });
    assert.equal(retried.disposition, 'saved');
    assert.equal(runtime.server.get().roomName, '別の保存');
    assert.equal(runtime.server.get().allocations.car.placements[ownerId].groupId, groupId);
    assert.equal(Object.keys(runtime.server.get().allocations.car.groups).length, 2);
  } finally { runtime.sync.dispose(); }
});

test('accepted allocation receipt never replays over a later manual edit', async () => {
  const runtime = await client();
  try {
    const receipt = command(runtime, 'randomize', { type: 'car' });
    const accepted = await settleAllocationSave(runtime, receipt);
    assert.equal(accepted.disposition, 'saved');
    const id = Object.values(runtime.store.getSnapshot().participants).find(p => p.name === 'B').id;
    runtime.store.command('move', { id, type: 'car' }); await runtime.sync.flush();
    const writes = runtime.server.writes();
    assert.equal((await settleAllocationSave(runtime, accepted.receipt, { retry: true })).disposition, 'saved');
    assert.equal(runtime.server.writes(), writes);
    assert.equal(runtime.server.get().allocations.car.placements[id].kind, 'waiting');
  } finally { runtime.sync.dispose(); }
});

test('matching current values and drained unrelated outbox are not an acknowledgement', async () => {
  const runtime = await client();
  try {
    const receipt = command(runtime, 'randomize', { type: 'car' });
    await runtime.sync.flush();
    const base = runtime.storage.read('base'); delete base.syncOperations[receipt.operationId];
    runtime.storage.write('base', base);
    const writes = runtime.server.writes();
    const unknown = await settleAllocationSave(runtime, receipt, { retry: true });
    assert.equal(unknown.disposition, 'unresolved');
    assert.equal(runtime.server.writes(), writes);
  } finally { runtime.sync.dispose(); }
});

test('a rejected operation cannot overwrite later changes on its own paths', async () => {
  const runtime = await client();
  try {
    const b = Object.values(runtime.store.getSnapshot().participants).find(p => p.name === 'B').id;
    const groupId = Object.keys(runtime.store.getSnapshot().allocations.car.groups)[0];
    runtime.transport.failOnce(new Error('permission denied'));
    const failed = await settleAllocationSave(runtime, command(runtime, 'move', { id: b, type: 'car', groupId }));
    const other = createRoomStore({ initial: runtime.server.get(), clock: { now: () => Date.now() + 10000 } });
    other.command('role', { id: b, type: 'car', driver: true });
    runtime.server.replace(other.getSnapshot()); await Promise.resolve();
    const writes = runtime.server.writes();
    assert.equal((await settleAllocationSave(runtime, failed.receipt, { retry: true })).disposition, 'adjusted');
    assert.equal(runtime.server.writes(), writes);
    assert.equal(runtime.server.get().allocations.car.placements[b].driver, true);
  } finally { runtime.sync.dispose(); }
});

test('reset invalidates an allocation receipt without replay', async () => {
  const runtime = await client();
  try {
    const receipt = command(runtime, 'randomize', { type: 'car' }); await runtime.sync.flush();
    const reset = runtime.server.get(); reset.resetGeneration++;
    runtime.server.replace(reset); await Promise.resolve();
    const writes = runtime.server.writes();
    assert.equal((await settleAllocationSave(runtime, receipt, { retry: true })).disposition, 'reset');
    assert.equal(runtime.server.writes(), writes);
  } finally { runtime.sync.dispose(); }
});

test('last-slot concurrent normalization is acknowledged as adjusted rather than intended success', async () => {
  const runtime = await client();
  try {
    const initial = runtime.store.getSnapshot();
    const b = Object.values(initial.participants).find(p => p.name === 'B').id;
    const c = Object.values(initial.participants).find(p => p.name === 'C').id;
    const groupId = Object.keys(initial.allocations.car.groups)[0];
    runtime.store.command('capacity', { type: 'car', groupId, capacity: 1 }); await runtime.sync.flush();
    // Canonical capacity keeps the earliest placement, not the latest one.
    // This competing occupant precedes the local move under that contract.
    const other = createRoomStore({ initial: runtime.server.get(), clock: { now: () => Date.now() - 1000 } });
    other.command('move', { id: c, type: 'car', groupId });
    const receipt = command(runtime, 'move', { id: b, type: 'car', groupId });
    runtime.server.replace(other.getSnapshot());
    const outcome = await settleAllocationSave(runtime, receipt);
    assert.equal(outcome.disposition, 'adjusted');
    assert.equal(outcome.receipt.acknowledged, true);
    assert.equal(runtime.store.getSnapshot().allocations.car.placements[b].kind, 'waiting');
    assert.equal(runtime.store.getSnapshot().allocations.car.placements[c].groupId, groupId);
  } finally { runtime.sync.dispose(); }
});

test('allocation receipt cache is isolated by room/type and retains memory when storage fails', () => {
  const values = new Map(); let fail = false;
  const storage = () => ({ getItem: key => values.get(key), setItem: (key, value) => { if (fail) throw new Error('quota'); values.set(key, value); }, removeItem: key => values.delete(key) });
  const car = createParticipantTaskDraft({ storage, roomId: 'E-SAVE', task: 'allocation:car' });
  assert.equal(car.write({ receipt: { operationId: 'op-1', patch: { 'allocations/car/groups/g1': null } } }), true);
  const reopened = createParticipantTaskDraft({ storage, roomId: 'E-SAVE', task: 'allocation:car' });
  assert.equal(reopened.read().receipt.operationId, 'op-1');
  assert.equal(createParticipantTaskDraft({ storage, roomId: 'E-SAVE', task: 'allocation:team' }).read(), null);
  assert.equal(createParticipantTaskDraft({ storage, roomId: 'E-OTHER', task: 'allocation:car' }).read(), null);
  fail = true; assert.equal(car.write({ receipt: { operationId: 'op-2' } }), false);
  assert.equal(reopened.read().receipt.operationId, 'op-2');
  assert.equal(reopened.isRecoverable(), false);
});

test('observing a recovered receipt never flushes or replays and follows its acknowledgement', async () => {
  const runtime = await client();
  try {
    const receipt = command(runtime, 'randomize', { type: 'car' });
    let calls = 0;
    const flush = runtime.sync.flush;
    runtime.sync = { ...runtime.sync, flush: () => { calls++; return flush(); } };
    await settleAllocationSave(runtime, receipt, { observe: true });
    assert.equal(calls, 0);
    await flush();
    assert.equal((await settleAllocationSave(runtime, receipt, { observe: true })).disposition, 'saved');
    assert.equal(calls, 0);
  } finally { runtime.sync.dispose(); }
});
