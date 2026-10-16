import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomStore } from '../src/store/room-store.js';
import { createRoomSync } from '../src/sync/room-sync.js';
import { createFirebaseTransport } from '../src/sync/firebase-transport.js';
import { beginSettlementEdit, beginStandaloneDriverNameEdit, applyStandaloneDriverName, assertStandaloneDriverNameTargetCurrent, writeSettlementDraft, commitSettlementEdit } from '../src/components/settlement/edit.js';
import { createFixtureServer, memoryStorage } from './helpers/fixture-transport.mjs';
import { fixture, plain } from './reference.mjs';

const clock = { now: () => 1000, isServerAligned: () => true };
function setup(server, clientId, options = {}) {
  const { deferInitial = false, initial = fixture, ...syncOptions } = options;
  const store = createRoomStore({ initial, clientId, clock });
  const storage = options.storage || memoryStorage();
  const transport = server.connect({ deferInitial });
  const sync = createRoomSync({ store, storage, transport, clientId, clock, legacyLoadWrites: false, ...syncOptions });
  return { store, storage, transport, sync };
}
const canonical = () => createRoomStore({ initial: fixture, clock }).getSnapshot();
async function drain(...clients) {
  await Promise.resolve();
  await Promise.all(clients.map(client => client.sync.flush()));
  await Promise.resolve();
  await Promise.all(clients.map(client => client.sync.flush()));
}

test('start/dispose/restart owns one listener and has no duplicated command writes', async () => {
  const server = createFixtureServer(canonical());
  const a = setup(server, 'device-a');
  a.sync.start(); a.sync.start();
  assert.equal(a.transport.stats().subscriptions, 1);
  await drain(a);
  a.store.command('rename', { name: '変更1' });
  await drain(a);
  assert.equal(server.writes(), 1);
  a.sync.dispose(); a.sync.dispose();
  assert.equal(a.transport.stats().subscriptions, 0);
  a.store.command('rename', { name: '停止中' });
  assert.equal(server.writes(), 1);
  a.sync.start();
  await drain(a);
  a.store.command('rename', { name: '変更2' });
  await drain(a);
  assert.equal(server.writes(), 2);
  assert.equal(server.get().roomName, '変更2');
  a.sync.dispose();
});

test('room hydration is false until a room callback and stays true after a later listener error', async () => {
  const server = createFixtureServer(null);
  const a = setup(server, 'hydrate-empty');
  assert.equal(a.sync.getSnapshot().hasLoadedRoom, false);
  a.sync.start();
  assert.equal(a.sync.getSnapshot().hasLoadedRoom, false);
  await drain(a);
  assert.equal(a.sync.getSnapshot().hasLoadedRoom, true, 'an empty room callback completes initial hydration');
  a.transport.failSubscription(new Error('network unavailable'));
  await Promise.resolve();
  assert.equal(a.sync.getSnapshot().hasLoadedRoom, true, 'a later error does not undo hydration');
  assert.equal(a.sync.getSnapshot().kind, 'error');
  a.sync.dispose();
});

test('initial listener errors leave room hydration incomplete until a valid callback arrives', async () => {
  const server = createFixtureServer(canonical());
  const a = setup(server, 'hydrate-error', { deferInitial: true });
  a.sync.start();
  a.transport.failSubscription(new Error('network unavailable'));
  await Promise.resolve();
  assert.equal(a.sync.getSnapshot().kind, 'error');
  assert.equal(a.sync.getSnapshot().hasLoadedRoom, false);
  a.transport.deliverInitial();
  await Promise.resolve();
  assert.equal(a.sync.getSnapshot().hasLoadedRoom, true);
  a.sync.dispose();
});

test('five devices converge on independent participant edits with one durable outbox each', async () => {
  const server = createFixtureServer(canonical());
  const clients = Array.from({ length: 5 }, (_, index) => setup(server, `device-${index}`));
  clients.forEach(client => client.sync.start());
  await drain(...clients);
  const ids = Object.keys(server.get().participants);
  clients.forEach((client, index) => client.store.command('editParticipant', { id: ids[index], changes: { memo: `端末${index}` } }));
  await drain(...clients);
  clients.forEach((client, index) => {
    assert.equal(server.get().participants[ids[index]].memo, `端末${index}`);
    assert.equal(client.storage.read('outbox'), null);
    assert.deepEqual(plain(client.store.getSnapshot()), plain(client.store.domain.migrate(server.get())));
    client.sync.dispose();
  });
});

test('simultaneous random assignments from two devices merge two unique runs', async () => {
  const server = createFixtureServer(canonical());
  const a = setup(server, 'random-a');
  const b = setup(server, 'random-b');
  a.sync.start(); b.sync.start(); await drain(a, b);
  a.store.command('randomize', { type: 'car' });
  b.store.command('randomize', { type: 'car' });
  await drain(a, b);
  assert.equal(Object.keys(server.get().allocations.car.randomization.runs).length, 2);
  assert.deepEqual(plain(a.store.getSnapshot()), plain(a.store.domain.migrate(server.get())));
  assert.deepEqual(plain(b.store.getSnapshot()), plain(b.store.domain.migrate(server.get())));
  a.sync.dispose(); b.sync.dispose();
});

test('replaying an acknowledged random assignment outbox does not increase the count', async () => {
  const server = createFixtureServer(canonical());
  const a = setup(server, 'replay-random');
  a.sync.start(); await drain(a);
  a.store.command('randomize', { type: 'car' });
  const acknowledged = a.storage.read('outbox');
  await drain(a);
  assert.equal(Object.keys(server.get().allocations.car.randomization.runs).length, 1);
  a.storage.write('outbox', acknowledged);
  await drain(a);
  assert.equal(Object.keys(server.get().allocations.car.randomization.runs).length, 1);
  a.sync.dispose();
});

test('three offline random assignments survive outbox coalescing and sync once online', async () => {
  const server = createFixtureServer(canonical());
  const pendingTimers = new Map();
  const timers = { setTimeout(fn) { pendingTimers.set(pendingTimers.size + 1, fn); return pendingTimers.size; }, clearTimeout(id) { pendingTimers.delete(id); } };
  const a = setup(server, 'offline-random', { timers });
  a.sync.start(); await drain(a);
  a.transport.setOnline(false);
  for (let i = 0; i < 3; i++) a.store.command('randomize', { type: 'car' });
  for (let i = 0; i < 10 && !pendingTimers.size; i++) await Promise.resolve();
  assert.equal(a.storage.read('outbox')?.randomizationIntents?.[0]?.runIds.length, 3);
  a.transport.setOnline(true);
  const retries = [...pendingTimers.values()]; pendingTimers.clear(); retries.forEach(retry => retry());
  await drain(a);
  assert.equal(Object.keys(server.get().allocations.car.randomization.runs).length, 3);
  assert.equal(a.storage.read('outbox'), null);
  a.sync.dispose();
});

test('a condition edit followed by randomization offline commits the final condition and its run together', async () => {
  const server = createFixtureServer(canonical());
  const pendingTimers = new Map();
  const timers = { setTimeout(fn) { pendingTimers.set(pendingTimers.size + 1, fn); return pendingTimers.size; }, clearTimeout(id) { pendingTimers.delete(id); } };
  const a = setup(server, 'offline-condition-run', { timers });
  a.sync.start(); await drain(a);
  const groupId = Object.keys(a.store.getSnapshot().allocations.car.groups)[0];
  const nextCapacity = a.store.getSnapshot().allocations.car.groups[groupId].capacity + 1;
  a.transport.setOnline(false);
  a.store.command('capacity', { type: 'car', groupId, capacity: nextCapacity });
  a.store.command('randomize', { type: 'car' });
  const entry = a.storage.read('outbox');
  assert.ok(Object.keys(entry.patch).some(path => path.startsWith(`allocations/car/groups/${groupId}`)), 'coalesced outbox retains the condition edit');
  assert.equal(entry.randomizationIntents[0].conditionsKey, a.store.domain.randomization.getRandomizationConditionsKey(entry.snapshot, 'car'));
  a.transport.setOnline(true);
  const retries = [...pendingTimers.values()]; pendingTimers.clear(); retries.forEach(retry => retry());
  await drain(a);
  assert.equal(server.get().allocations.car.groups[groupId].capacity, nextCapacity);
  assert.equal(Object.keys(server.get().allocations.car.randomization.runs).length, 1);
  assert.equal(server.get().allocations.car.randomization.conditionsKey, a.store.domain.randomization.getRandomizationConditionsKey(server.get(), 'car'));
  a.sync.dispose();
});

test('an offline random assignment is rejected after another device changes capacity', async () => {
  const server = createFixtureServer(canonical());
  const a = setup(server, 'stale-random-a');
  const b = setup(server, 'stale-random-b');
  a.sync.start(); b.sync.start(); await drain(a, b);
  a.transport.setOnline(false);
  a.store.command('randomize', { type: 'car' });
  const staleIntent = a.storage.read('outbox').randomizationIntents[0];
  const staleEpoch = staleIntent.epochId;
  const groupId = Object.keys(b.store.getSnapshot().allocations.car.groups)[0];
  const originalCapacity = b.store.getSnapshot().allocations.car.groups[groupId].capacity;
  b.store.command('capacity', { type: 'car', groupId, capacity: 8 });
  await drain(b);
  b.store.command('capacity', { type: 'car', groupId, capacity: originalCapacity });
  await drain(b);
  a.transport.setOnline(true);
  await drain(a);
  assert.equal(a.storage.read('outbox'), null);
  assert.equal(a.sync.getSnapshot().kind, 'error');
  assert.notEqual(server.get().allocations.car.randomization?.epochId, staleEpoch);
  assert.equal(b.store.domain.randomization.getRandomizationConditionsKey(server.get(), 'car'), staleIntent.conditionsKey, 'conditions can return to the prior values while the prior epoch remains expired');
  assert.equal(Object.keys(server.get().allocations.car.randomization?.runs || {}).length, 0);
  assert.deepEqual(plain(a.store.getSnapshot()), plain(a.store.domain.migrate(server.get())));
  a.sync.dispose(); b.sync.dispose();
});

test('an older acknowledgement cannot clear a newer outbox or lose its normal in-flight edit', async () => {
  const server = createFixtureServer(canonical());
  const a = setup(server, 'device-a');
  a.sync.start();
  await drain(a);
  const ids = Object.keys(a.store.getSnapshot().participants);
  a.store.command('editParticipant', { id: ids[0], changes: { memo: 'first' } });
  const first = a.storage.read('outbox');
  a.store.command('editParticipant', { id: ids[1], changes: { memo: 'second' } });
  const second = a.storage.read('outbox');
  assert.notEqual(first.id, second.id);
  await drain(a);
  assert.equal(server.get().participants[ids[0]].memo, 'first');
  assert.equal(server.get().participants[ids[1]].memo, 'second');
  assert.equal(a.storage.read('outbox'), null);
  a.sync.dispose();
});

test('durable replay is idempotent, expired entries and reset generations are rejected', async () => {
  const server = createFixtureServer(canonical());
  const a = setup(server, 'device-a');
  const base = a.store.getSnapshot();
  const local = structuredClone(base); local.roomName = '再送';
  const entry = a.sync.enqueue({ base, local });
  a.sync.start(); await drain(a);
  const revision = server.get().revision;
  a.storage.write('outbox', entry);
  await drain(a);
  assert.equal(server.get().revision, revision);
  const reset = server.get(); reset.resetGeneration = 1;
  server.replace(reset);
  a.storage.write('outbox', entry);
  await drain(a);
  assert.equal(a.storage.read('outbox'), null);
  assert.equal(server.get().resetGeneration, 1);
  a.sync.dispose();
  const expired = setup(server, 'expired', { clock: { now: () => 86401001 } });
  expired.storage.write('outbox', entry);
  expired.sync.start(); await drain(expired);
  assert.equal(expired.storage.read('outbox'), null);
  expired.sync.dispose();
});

test('legacy initial load restores local data remotely and strips presentation fields', async () => {
  const server = createFixtureServer(null);
  const a = setup(server, 'device-a', { legacyLoadWrites: true });
  a.storage.write('room', canonical());
  a.sync.start(); await drain(a);
  assert.equal(Object.keys(server.get().participants).length, 6);
  assert.equal(server.get().schemaVersion, 6);
  assert.equal(server.get().activeAllocationType, undefined);
  assert.equal(server.get().trayMinimized, undefined);
  assert.deepEqual(server.get().meta.applicationSync, fixture.meta.applicationSync);
  a.sync.dispose();
});

test('legacy maxretry fallback remains a precise update and permanent Rules rejection stops replay', async () => {
  const server = createFixtureServer(canonical());
  const a = setup(server, 'device-a');
  a.sync.start(); await drain(a);
  a.transport.failOnce(new Error('maxretry'));
  a.store.command('rename', { name: 'fallback' });
  await drain(a);
  assert.equal(a.transport.stats().updates, 1);
  assert.equal(server.get().roomName, 'fallback');
  assert.equal(server.get().revision, 0, 'legacy update fallback does not increase revision');
  a.transport.failOnce(new Error('PERMISSION_DENIED'));
  a.store.command('rename', { name: '拒否される編集' });
  await drain(a);
  assert.equal(a.storage.read('outbox'), null);
  assert.equal(a.sync.getSnapshot().kind, 'error');
  assert.equal(server.get().roomName, 'fallback');
  a.sync.dispose();
});

test('disposing during a retry clears the timer and never starts a second transaction', async () => {
  const server = createFixtureServer(canonical());
  const pendingTimers = new Map();
  const timers = { setTimeout(fn) { pendingTimers.set(1, fn); return 1; }, clearTimeout(id) { pendingTimers.delete(id); } };
  const a = setup(server, 'device-a', { timers });
  a.sync.start(); await drain(a);
  a.transport.failOnce(new Error('network unavailable'));
  a.store.command('rename', { name: '保存待ち' });
  for (let i = 0; i < 10 && !pendingTimers.size; i++) await Promise.resolve();
  assert.equal(pendingTimers.size, 1);
  const flight = a.sync.flush();
  a.sync.dispose();
  await flight;
  assert.equal(pendingTimers.size, 0);
  assert.equal(server.writes(), 0);
  assert.ok(a.storage.read('outbox'));
});

test('offline edits stay in the durable outbox and sync after the client comes online', async () => {
  const server = createFixtureServer(canonical());
  const pendingTimers = new Map();
  const timers = { setTimeout(fn) { pendingTimers.set(1, fn); return 1; }, clearTimeout(id) { pendingTimers.delete(id); } };
  const a = setup(server, 'device-a', { timers });
  a.sync.start();
  await drain(a);
  a.transport.setOnline(false);
  a.store.command('rename', { name: 'オフライン編集' });
  for (let i = 0; i < 10 && !pendingTimers.size; i++) await Promise.resolve();
  assert.equal(server.get().roomName, fixture.roomName);
  assert.equal(a.storage.read('outbox')?.snapshot.roomName, 'オフライン編集');
  assert.equal(pendingTimers.size, 1);

  const flight = a.sync.flush();
  a.transport.setOnline(true);
  const [retry] = pendingTimers.values();
  pendingTimers.clear();
  retry();
  await flight;
  assert.equal(server.get().roomName, 'オフライン編集');
  assert.equal(a.storage.read('outbox'), null);
  assert.equal(a.sync.getSnapshot().kind, 'connected');
  a.sync.dispose();
});

test('standalone driver rename aborts atomically when the remote vehicle record changes after the local check', async () => {
  const seed = createRoomStore({ initial: canonical(), clientId: 'seed', clock });
  const settings = beginSettlementEdit(seed, { standalone: true });
  settings.state.standalone = { enabled: true, driverCount: '1', memberCount: '0', driverNames: ['運転手A'] };
  writeSettlementDraft(seed, settings);
  seed.commitEdit(settings.session);

  const server = createFixtureServer(seed.getSnapshot());
  const a = setup(server, 'driver-name-guard', { initial: seed.getSnapshot() });
  a.sync.start();
  await drain(a);
  const edit = beginStandaloneDriverNameEdit(a.store, 0);
  assertStandaloneDriverNameTargetCurrent(a.store, edit);
  assert.equal(applyStandaloneDriverName(edit, edit.state, '新しい名前').ok, true);

  const remote = server.get();
  remote.settlement.carsByName['運転手A'] = { rentalType: 'private', dist: '10', eco: '10', price: '100', extras: [{ id: 'remote-expense', name: '駐車場', amount: '500', type: 'split' }] };
  const transact = a.transport.transaction.bind(a.transport);
  let injected = false;
  a.transport.transaction = async updater => {
    if (!injected) { injected = true; server.replace(remote); }
    return transact(updater);
  };

  await assert.rejects(commitSettlementEdit(a, edit), /別の端末で精算情報が変更/);
  const current = a.store.domain.settlementInput(a.store.getSnapshot()).state;
  assert.equal(current.cars['運転手A'].extras[0].id, 'remote-expense');
  assert.equal(Object.hasOwn(current.cars, '新しい名前'), false);
  assert.equal(a.storage.read('outbox'), null);
  assert.equal(a.sync.getSnapshot().kind, 'error');
  a.sync.dispose();
});

test('SDK boundary rejects an unspecified production connection before initialization', async () => {
  await assert.rejects(createFirebaseTransport({ config: { projectId: 'production' }, roomId: 'ROOM001' }), /staging/);
  await assert.rejects(createFirebaseTransport({ config: { projectId: 'demo-test' }, roomId: 'ROOM001', emulator: { host: 'example.com' } }), /loopback/);
  await assert.rejects(createFirebaseTransport({ config: { projectId: 'demo-test' }, roomId: 'bad', emulator: { host: '127.0.0.1' } }), /企画ID/);
});
