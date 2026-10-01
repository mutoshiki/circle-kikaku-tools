import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomStore } from '../src/store/room-store.js';
import { participantSaveReceipt, retryParticipantSave, completeParticipantSave } from '../src/ui/participant-save.js';
import { createRoomSync } from '../src/sync/room-sync.js';
import { createFixtureServer, memoryStorage } from './helpers/fixture-transport.mjs';
import { fixture } from './reference.mjs';
import { createApplicantSync } from '../src/sync/applicant-sync.js';

test('a serializable participant retry receipt preserves identity and unrelated latest state', () => {
  const store = createRoomStore();
  const intent = store.command('addParticipants', { people: [{ name: '再試行', grade: 2, driver: true }] });
  const receipt = JSON.parse(JSON.stringify(participantSaveReceipt(store.domain.sync, intent)));
  assert.equal(Object.hasOwn(receipt, 'local'), false);
  assert.equal(Object.hasOwn(receipt, 'base'), false);
  store.command('rename', { name: '別端末の新しい企画名' });
  let queued;
  const runtime = { store, storage: { read: () => null }, sync: { enqueue: value => { queued = value; } } };
  retryParticipantSave(runtime, receipt);
  assert.deepEqual(queued.patch, intent.patch);
  assert.deepEqual(queued.local.participants, intent.local.participants);
  assert.equal(queued.local.roomName, '別端末の新しい企画名');
  assert.equal(Object.hasOwn(queued.patch, 'roomName'), false);
  assert.deepEqual(queued.base.participants, intent.base.participants);
});

test('a participant receipt cannot replay across a room reset', () => {
  const store = createRoomStore();
  const intent = store.command('addParticipants', { people: [{ name: '旧企画' }] });
  const receipt = participantSaveReceipt(store.domain.sync, intent);
  const next = structuredClone(store.getSnapshot()); next.resetGeneration++;
  store.receiveRemote(next);
  assert.throws(() => retryParticipantSave({ store }, receipt), /リセット/);
});

function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  return value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value;
}
async function client(initial = {}, reorder = false) {
  let tick = Date.now();
  const clock = { now: () => ++tick, isServerAligned: () => true };
  const store = createRoomStore({ clock, initial });
  const server = createFixtureServer(store.getSnapshot()), transport = server.connect(), storage = memoryStorage();
  if (reorder) {
    const transaction = transport.transaction.bind(transport);
    transport.transaction = updater => transaction(current => ordered(updater(current)));
  }
  const sync = createRoomSync({ store, storage, transport, clientId: 'receipt-test', clock, legacyLoadWrites: false });
  sync.start(); await Promise.resolve();
  return { store, server, transport, storage, sync };
}
function add(runtime) {
  const intent = runtime.store.command('addParticipants', { people: [{ name: '登録した人', grade: 1 }] });
  return participantSaveReceipt(runtime.store.domain.sync, intent, runtime.storage.read('outbox'));
}

test('an unrelated pending save cannot consume a rejected participant registration', async () => {
  const runtime = await client();
  try {
    runtime.transport.failOnce(new Error('permission denied'));
    const receipt = add(runtime);
    await runtime.sync.flush();
    runtime.store.command('rename', { name: '独立した企画名編集' });
    await completeParticipantSave(runtime, receipt);
    assert.equal(Object.values(runtime.server.get().participants)[0]?.name, '登録した人');
    assert.equal(runtime.server.get().roomName, '独立した企画名編集');
  } finally { runtime.sync.dispose(); }
});

test('an acknowledged registration receipt never replays over later participant edits', async () => {
  const runtime = await client();
  try {
    const receipt = add(runtime);
    await runtime.sync.flush();
    const id = Object.keys(runtime.server.get().participants)[0];
    runtime.store.command('editParticipant', { id, changes: { name: '後から修正した名前', grade: 3 } });
    await runtime.sync.flush();
    const writes = runtime.server.writes();
    await completeParticipantSave(runtime, receipt);
    assert.equal(runtime.server.writes(), writes);
    assert.equal(runtime.server.get().participants[id].name, '後から修正した名前');
    assert.equal(runtime.server.get().participants[id].grade, 3);
  } finally { runtime.sync.dispose(); }
});

test('a conflict-adjusted registration is not reported as a successful registration', async () => {
  const runtime = await client();
  try {
    runtime.transport.failOnce(new Error('permission denied'));
    const receipt = add(runtime);
    await runtime.sync.flush();
    const id = Object.keys(runtime.store.getSnapshot().participants)[0];
    const deleted = structuredClone(runtime.store.getSnapshot());
    delete deleted.participants[id];
    deleted.participantTombstones[id] = { deletedAt: Date.now() + 10000, deletedBy: 'other' };
    runtime.server.replace(deleted); await Promise.resolve();
    let retained = receipt;
    await assert.rejects(() => completeParticipantSave(runtime, retained, next => { retained = next; }), /同時編集/);
    await assert.rejects(() => completeParticipantSave(runtime, retained), /同時編集/);
    assert.equal(Object.keys(runtime.server.get().participants).length, 0);
  } finally { runtime.sync.dispose(); }
});

test('successful selection survives RTDB object key ordering and existing applicant reconciliation', async () => {
  const runtime = await client(fixture, true);
  const applicantSync = createApplicantSync({ store: runtime.store, transport: { subscribeApplicationMetadata: () => () => {} } });
  applicantSync.start(); await runtime.sync.flush();
  try {
    runtime.transport.failOnce(new Error('permission denied'));
    const intent = runtime.store.command('applySelection', { selectedApplicants: ['fixture-response-a', 'fixture-response-g'], selectedManual: Object.keys(runtime.store.getSnapshot().participants) });
    const receipt = participantSaveReceipt(runtime.store.domain.sync, intent, runtime.storage.read('outbox') || {});
    await runtime.sync.flush();
    await completeParticipantSave(runtime, receipt).catch(error => {
      const outcome = runtime.store.domain.sync.summarizeSyncOutcome(receipt.patch, {}, runtime.store.getSnapshot());
      assert.fail(`${error.message} ${JSON.stringify(outcome)}`);
    });
    assert.equal(Object.values(runtime.server.get().participants).some(p => p.name === '仮参加者G'), true);
  } finally { applicantSync.dispose(); runtime.sync.dispose(); }
});
