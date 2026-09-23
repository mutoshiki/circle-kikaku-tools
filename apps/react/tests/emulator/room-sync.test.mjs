import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomStore } from '../../src/store/room-store.js';
import { createRoomSync } from '../../src/sync/room-sync.js';
import { createFirebaseTransport } from '../../src/sync/firebase-transport.js';
import { memoryStorage } from '../helpers/fixture-transport.mjs';
import { fixture, createReference, plain } from '../reference.mjs';

const projectId = 'demo-circle-react';
const config = { apiKey: 'demo-api-key', projectId, databaseURL: `https://${projectId}-default-rtdb.firebaseio.com` };
const emulator = { host: '127.0.0.1', authPort: 9098, databasePort: 9008 };
async function seed(roomId, value) {
  const response = await fetch(`http://127.0.0.1:9008/rooms/${roomId}.json?ns=${projectId}-default-rtdb`, { method: 'PUT', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  assert.equal(response.status, 200, await response.text());
}
async function read(roomId) {
  const response = await fetch(`http://127.0.0.1:9008/rooms/${roomId}.json?ns=${projectId}-default-rtdb`, { headers: { Authorization: 'Bearer owner' } });
  assert.equal(response.status, 200);
  return response.json();
}
function observe(service, predicate, timeout = 12000) {
  if (predicate(service.getSnapshot())) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { stop(); reject(new Error('Timed out waiting for service state: ' + JSON.stringify(service.getSnapshot()))); }, timeout);
    const stop = service.subscribe(() => { if (predicate(service.getSnapshot())) { clearTimeout(timer); stop(); resolve(); } });
  });
}
async function client(roomId, clientId, options = {}) {
  const transport = await createFirebaseTransport({ config, roomId, emulator });
  const store = createRoomStore({ clientId, clock: transport.clock });
  const storage = memoryStorage();
  const sync = createRoomSync({ store, storage, transport, clock: transport.clock, clientId, legacyLoadWrites: false, ...options });
  sync.start();
  await observe(sync, status => status.kind === 'connected' || status.kind === 'error');
  return { transport, store, storage, sync, async dispose() { sync.dispose(); await transport.dispose(); } };
}

test('real SDK + Auth/RTDB Emulator: current Rules accept React schema6 writes and legacy readers', { timeout: 30000 }, async () => {
  const roomId = 'RCEMULATOR01';
  const reference = createReference();
  const initial = reference.migrateAppData(fixture);
  initial.meta.applicantParticipantIds = { 'fixture-response-a': Object.keys(initial.participants)[0] };
  await seed(roomId, initial);
  const clients = [];
  try {
    clients.push(await client(roomId, 'react-a'));
    clients.push(await client(roomId, 'react-b'));
    const ids = Object.keys(clients[0].store.getSnapshot().participants);
    clients[0].store.command('editParticipant', { id: ids[0], changes: { memo: 'Emulator端末A' } });
    clients[1].store.command('editParticipant', { id: ids[1], changes: { memo: 'Emulator端末B' } });
    await Promise.all(clients.map(c => c.sync.flush()));
    for (const c of clients) assert.equal(c.sync.getSnapshot().kind, 'connected', c.sync.getSnapshot().error);
    const saved = await read(roomId);
    assert.equal(saved.schemaVersion, 6);
    assert.equal(saved.participants[ids[0]].memo, 'Emulator端末A');
    assert.equal(saved.participants[ids[1]].memo, 'Emulator端末B');
    assert.deepEqual(saved.meta.applicationSync, fixture.meta.applicationSync);
    assert.deepEqual(saved.meta.applicantParticipantIds, initial.meta.applicantParticipantIds);
    const oldRoom = reference.migrateAppData(saved);
    const newRoom = clients[0].store.domain.migrate(saved);
    assert.deepEqual(plain(oldRoom), plain(newRoom));
    const comparison = createRoomStore({ initial: saved, clock: { now: () => 1000 } });
    for (const type of ['car', 'team']) assert.deepEqual(plain(reference.SanpoCanonicalState.projectAllocation(oldRoom, type)), plain(comparison.domain.canonical.projectAllocation(newRoom, type)));
    assert.ok(saved.revision >= 2);
  } finally { await Promise.all(clients.map(c => c.dispose())); }
});

test('React cleanup can remove activeAllocationType while Rules keep accepting legacy readers', { timeout: 25000 }, async () => {
  const roomId = 'RCEMULATOR02';
  const reference = createReference();
  await seed(roomId, reference.migrateAppData(fixture));
  const c = await client(roomId, 'react-cleanup', { legacyLoadWrites: true });
  try {
    await c.sync.flush();
    assert.equal(c.sync.getSnapshot().kind, 'connected');
    assert.equal(c.storage.read('outbox'), null, 'accepted cleanup must clear the outbox');
    const saved = await read(roomId);
    assert.equal(saved.activeAllocationType, undefined);
    assert.equal(Object.keys(saved.participants).length, 6);
    assert.equal(saved.schemaVersion, 6);
  } finally { await c.dispose(); }
});

test('emulator rejects a future schema and preserves pending local intent without writing', { timeout: 25000 }, async () => {
  const roomId = 'RCEMULATOR03';
  const room = createReference().migrateAppData(fixture);
  room.schemaVersion = 7;
  await seed(roomId, room);
  const c = await client(roomId, 'react-future');
  try {
    assert.equal(c.sync.getSnapshot().kind, 'error');
    assert.match(c.sync.getSnapshot().message, /新版/);
    assert.equal((await read(roomId)).schemaVersion, 7);
  } finally { await c.dispose(); }
});
