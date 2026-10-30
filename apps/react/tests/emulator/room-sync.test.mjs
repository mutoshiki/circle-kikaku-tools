import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomStore } from '../../src/store/room-store.js';
import { createRoomSync } from '../../src/sync/room-sync.js';
import { createFirebaseTransport } from '../../src/sync/firebase-transport.js';
import { memoryStorage } from '../helpers/fixture-transport.mjs';
import { fixture, createReference, plain } from '../reference.mjs';
import { createTemplateWorkspace } from '../../src/services/project-workspace.js';

const projectId = 'demo-circle-react';
const config = { apiKey: 'demo-api-key', projectId, databaseURL: `https://${projectId}-default-rtdb.firebaseio.com` };
const emulator = { host: '127.0.0.1', authPort: 9098, databasePort: 9008 };
async function seed(roomId, value) {
  const response = await fetch(`http://127.0.0.1:9008/rooms/${roomId}.json?ns=${projectId}-default-rtdb`, { method: 'PUT', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  assert.equal(response.status, 200, await response.text());
}
async function seedPath(path, value) {
  const response = await fetch(`http://127.0.0.1:9008/${path}.json?ns=${projectId}-default-rtdb`, { method: 'PUT', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  assert.equal(response.status, 200, await response.text());
}
async function read(roomId) {
  const response = await fetch(`http://127.0.0.1:9008/rooms/${roomId}.json?ns=${projectId}-default-rtdb`, { headers: { Authorization: 'Bearer owner' } });
  assert.equal(response.status, 200);
  return response.json();
}
async function readWorkspace(roomId) {
  const response = await fetch(`http://127.0.0.1:9008/projectWorkspacesV1/${roomId}.json?ns=${projectId}-default-rtdb`, { headers: { Authorization: 'Bearer owner' } });
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
    clients[0].store.command('randomize', { type: 'car' });
    clients[1].store.command('randomize', { type: 'car' });
    await Promise.all(clients.map(c => c.sync.flush()));
    for (const c of clients) assert.equal(c.sync.getSnapshot().kind, 'connected', c.sync.getSnapshot().error);
    const saved = await read(roomId);
    assert.equal(saved.schemaVersion, 6);
    assert.equal(saved.participants[ids[0]].memo, 'Emulator端末A');
    assert.equal(saved.participants[ids[1]].memo, 'Emulator端末B');
    assert.deepEqual(saved.meta.applicationSync, fixture.meta.applicationSync);
    assert.deepEqual(saved.meta.applicantParticipantIds, initial.meta.applicantParticipantIds);
    assert.equal(Object.keys(saved.allocations.car.randomization.runs).length, 2, 'two authenticated RTDB clients preserve both concurrent randomization runs');
    const oldRoom = reference.migrateAppData(saved);
    const newRoom = clients[0].store.domain.migrate(saved);
    assert.deepEqual(plain(oldRoom), plain(newRoom));
    const comparison = createRoomStore({ initial: saved, clock: { now: () => 1000 } });
    for (const type of ['car', 'team']) assert.deepEqual(plain(reference.SanpoCanonicalState.projectAllocation(oldRoom, type)), plain(comparison.domain.canonical.projectAllocation(newRoom, type)));
    assert.ok(saved.revision >= 2);
  } finally { await Promise.all(clients.map(c => c.dispose())); }
});

test('real SDK + Auth/RTDB Emulator: form-link reservation is scoped to an existing room and leaves room data unchanged', { timeout: 30000 }, async () => {
  const roomId = 'FORM_LINK_ROOM_01';
  const original = createReference().migrateAppData(fixture);
  delete original.meta.applicationSync;
  await seed(roomId, original);
  const roomBefore = await read(roomId);
  const transport = await createFirebaseTransport({ config, roomId, emulator });
  const requestedAt = Date.now();
  const reservation = { schemaVersion: 1, jobId: 'a'.repeat(32), tokenHash: 'b'.repeat(64), state: 'pending', requestedAt, expiresAt: requestedAt + 60 * 60 * 1000 };
  try {
    const created = await transport.reserveApplicationFormLink(roomId, reservation);
    assert.equal(created.jobId, reservation.jobId);
    const roomAfter = await read(roomId);
    assert.deepEqual(roomAfter, roomBefore, 'the reservation sidecar must not rewrite or initialize the project room');
    await assert.rejects(transport.reserveApplicationFormLink(roomId, { ...reservation, jobId: 'c'.repeat(32), tokenHash: 'd'.repeat(64) }), /応募フォームは作成を受け付け済み/);
    assert.deepEqual(await read(roomId), roomBefore);
  } finally {
    await transport.dispose();
  }
});

test('real SDK + Auth/RTDB Emulator: protocol v2 job must match its one-time project reservation', { timeout: 30000 }, async () => {
  const roomId = 'FORM_LINK_JOB_01';
  const original = createReference().migrateAppData(fixture);
  delete original.meta.applicationSync;
  await seed(roomId, original);
  const requestedAt = Date.now();
  await seedPath('formMakerV1/status', { accepting: true, state: 'ready', dailyCount: 0, dailyLimit: 16, updatedAt: requestedAt, errorCode: '', acceptanceMode: 'open' });
  const authResponse = await fetch('http://127.0.0.1:9098/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }),
  });
  assert.equal(authResponse.status, 200, await authResponse.clone().text());
  const { localId, idToken } = await authResponse.json();
  const jobId = 'a'.repeat(32);
  const targetRoomCapabilityHash = 'b'.repeat(64);
  const handoffTokenHash = 'c'.repeat(64);
  const reservation = { schemaVersion: 1, jobId, tokenHash: targetRoomCapabilityHash, state: 'pending', requestedAt, expiresAt: requestedAt + 60 * 60 * 1000 };
  const root = `http://127.0.0.1:9008`;
  const ns = `ns=${projectId}-default-rtdb`;
  const auth = `auth=${encodeURIComponent(idToken)}`;
  const put = async (path, value) => fetch(`${root}/${path}.json?${ns}&${auth}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  assert.equal((await put(`projectFormLinksV1/${roomId}`, reservation)).status, 200);
  const input = { planName: '検証企画', editorEmail: 'editor@example.test', eventDate: '', deadline: '', description: '', handoffTokenHash, targetRoomId: roomId, targetRoomCapabilityHash };
  const inputHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(input))).then(bytes => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join(''));
  const slot = { uid: localId, jobId, kind: 'create', requestHash: inputHash, requestedAt };
  assert.equal((await put('formMakerV1/admission/slots/01', slot)).status, 200);
  const job = { jobId, protocolVersion: 2, admissionSlotId: '01', input, inputHash, requestedAt, state: 'queued' };
  assert.equal((await put(`formMakerV1/users/${localId}/jobs/${jobId}`, job)).status, 200, 'matching protocol v2 reservations are accepted');

  const invalidJobId = 'd'.repeat(32);
  const invalidInput = { ...input, targetRoomCapabilityHash: 'e'.repeat(64) };
  const invalidHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(invalidInput))).then(bytes => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join(''));
  assert.equal((await put('formMakerV1/admission/slots/02', { uid: localId, jobId: invalidJobId, kind: 'create', requestHash: invalidHash, requestedAt })).status, 200);
  const invalid = { ...job, jobId: invalidJobId, admissionSlotId: '02', input: invalidInput, inputHash: invalidHash };
  const denied = await put(`formMakerV1/users/${localId}/jobs/${invalidJobId}`, invalid);
  assert.equal(denied.status, 401, await denied.text());
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

test('workspace sidecar syncs between clients, revisions are preserved, and a missing room cannot acquire settings', { timeout: 30000 }, async () => {
  const roomId = 'RCWORKSPACE01';
  await seed(roomId, createReference().migrateAppData(fixture));
  const transportA = await createFirebaseTransport({ config, roomId, emulator });
  const transportB = await createFirebaseTransport({ config, roomId, emulator });
  const workspace = createTemplateWorkspace({ templateId: 'personal', now: 100 });
  try {
    const roomBefore = await read(roomId);
    const created = await transportA.transactionWorkspace(current => current == null ? workspace : undefined);
    assert.equal(created.committed, true);
    let stopB;
    const observed = new Promise((resolve, reject) => {
      stopB = transportB.subscribeWorkspace(value => { if (value) resolve(value); }, reject);
    });
    assert.equal((await observed).revision, 0, 'the second client has the initial workspace before editing');
    const changed = { ...created.value, tools: { ...created.value.tools, team: { enabled: true, pinned: true } }, tabOrder: [...created.value.tabOrder, 'team'], revision: 1, updatedAt: 200 };
    const saved = await transportB.transactionWorkspace(current => current?.revision === 0 ? changed : undefined);
    stopB?.();
    assert.equal(saved.committed, true);
    assert.deepEqual((await readWorkspace(roomId)).tabOrder, ['participants', 'car', 'settlement', 'team']);
    assert.deepEqual(await read(roomId), roomBefore, 'the workspace path is separate from canonical room data');
  } finally { await Promise.all([transportA.dispose(), transportB.dispose()]); }

  const missing = await createFirebaseTransport({ config, roomId: 'RCWORKSPACE02', emulator });
  try {
    await assert.rejects(missing.transactionWorkspace(() => workspace));
    assert.equal(await readWorkspace('RCWORKSPACE02'), null);
  } finally { await missing.dispose(); }
});
