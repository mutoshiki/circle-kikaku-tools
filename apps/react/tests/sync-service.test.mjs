import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomStore } from '../src/store/room-store.js';
import { createRoomSync } from '../src/sync/room-sync.js';
import { createFirebaseTransport } from '../src/sync/firebase-transport.js';
import { createFixtureServer, memoryStorage } from './helpers/fixture-transport.mjs';
import { fixture, plain } from './reference.mjs';

const clock = { now: () => 1000, isServerAligned: () => true };
function setup(server, clientId, options = {}) {
  const store = createRoomStore({ initial: fixture, clientId, clock });
  const storage = options.storage || memoryStorage();
  const transport = server.connect();
  const sync = createRoomSync({ store, storage, transport, clientId, clock, legacyLoadWrites: false, ...options });
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

test('SDK boundary rejects an unspecified production connection before initialization', async () => {
  await assert.rejects(createFirebaseTransport({ config: { projectId: 'production' }, roomId: 'ROOM001' }), /staging/);
  await assert.rejects(createFirebaseTransport({ config: { projectId: 'demo-test' }, roomId: 'ROOM001', emulator: { host: 'example.com' } }), /loopback/);
  await assert.rejects(createFirebaseTransport({ config: { projectId: 'demo-test' }, roomId: 'bad', emulator: { host: '127.0.0.1' } }), /企画ID/);
});
