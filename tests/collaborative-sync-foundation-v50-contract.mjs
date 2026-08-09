import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const entitySource = read('assets/js/core/entity-state-v5.js');
const syncSource = read('assets/js/core/sync-controller.js');
const runtimeSource = read('assets/js/core/runtime.js');

const context = vm.createContext({
  window: {}, console, Date, JSON, Math, Object, Array, Set, Map, String, Number,
  parseInt, encodeURIComponent, decodeURIComponent,
  APP_SCHEMA_VERSION: 5,
  CFG: { STORE: 'test' }, roomId: 'ROOM', myClientId: 'client-A',
  safeJsonParse: JSON.parse,
  L: { getItem: () => null, setItem() {}, removeItem() {} }, J: JSON,
  isRemoteUpdate: false, dbRef: null, lastSyncedData: null, lastSyncedRevision: 0,
  pendingRemoteSettlementData: null, saveRequestVersion: 0, saveTimer: null,
  syncWriteInFlight: false, isSettlementInputProtected: () => false,
  isDraggingCards: false, manualCardDrag: null, manualSheetDrag: null, isProcessingQueue: false,
  updateStatus() {}, restore() {}, getData: () => ({}),
  queueMicrotask: fn => fn(), requestAnimationFrame: fn => fn(),
  byId: () => null, currentView: 'list', location: { reload() {} },
  editLockEnabled: false, editLockPassphrase: '', editLockScopes: {}, carPlans: [],
  activeCarPlanId: '', lastAutoAssignLabel: '', rememberTrustedDevice() {},
  updateEditLockButton() {}, refreshRoomTitle() {}, updateUI() {}, hideAppLoadingSkeleton() {},
  requestPassphrasePanel: async () => '', getTrustedDeviceKey: () => '',
  set: async () => {}, update: async () => {}, onValue() {}
});
context.window = context;
context.window.SanpoClock = { now: () => Date.now(), isServerAligned: () => true };
context.window.scrollX = 0;
context.window.scrollY = 0;
context.window.scrollTo = () => {};
vm.runInContext(entitySource, context);
context.migrateAppData = value => context.window.SanpoCanonicalState.migrate(value || {});
vm.runInContext(syncSource, context);
const entity = context.window.SanpoCanonicalState;
const sync = context.window.SanpoEntitySyncTest;
const copy = value => structuredClone(value);

// RTDB removes empty object properties. A valid zero-participant v5 room must remain v5.
{
  const encoded = copy(entity.emptyRoom());
  encoded.roomName = 'empty-v5';
  delete encoded.participants;
  const decoded = entity.migrate(encoded);
  assert.equal(decoded.schemaVersion, 5);
  assert.equal(decoded.roomName, 'empty-v5');
  assert.ok(decoded.allocations.car && decoded.allocations.team);
  assert.deepEqual(Object.keys(decoded.participants), []);
}

// A first user action can race the initial empty-room transaction. Its entity paths must
// survive even when Firebase supplies a raw null/{} room to the transaction callback.
{
  const base = entity.emptyRoom();
  const local = copy(base);
  const id = entity.ensureParticipant(local.participants, { name: 'First user', updatedAt: 100 });
  local.allocations.car.placements[id] = { kind: 'waiting', groupId: '', order: 0, updatedAt: 100 };
  local.allocations.team.placements[id] = { kind: 'waiting', groupId: '', order: 0, updatedAt: 100 };
  local.lastUpdatedAt = 100;
  local.lastUpdatedBy = 'client-A';
  const patch = sync.buildEntityPatch(base, local);
  const merged = sync.applyVersionedEntityPatch({}, base, local, patch, 1);
  assert.equal(merged.participants[id].name, 'First user');
  assert.equal(merged.allocations.car.placements[id].kind, 'waiting');
}

function sampleRoom() {
  const room = entity.emptyRoom();
  const alice = entity.ensureParticipant(room.participants, { name: 'Alice', updatedAt: 10 });
  const bob = entity.ensureParticipant(room.participants, { name: 'Bob', updatedAt: 10 });
  for (const type of ['car', 'team']) {
    room.allocations[type].placements[alice] = { kind: 'waiting', groupId: '', order: 0, updatedAt: 10 };
    room.allocations[type].placements[bob] = { kind: 'waiting', groupId: '', order: 1, updatedAt: 10 };
  }
  room.settlement = { carsByParticipantId: { [alice]: { dist: '10', price: '100', updatedAt: 10 } } };
  room.lastUpdatedAt = 10;
  room.lastUpdatedBy = 'seed';
  return { room: entity.migrate(room), alice, bob };
}

// Reading an unchanged DOM projection is not a write. Map insertion order must not advance
// room/allocation timestamps or create unrelated Firebase patches.
{
  const { room } = sampleRoom();
  entity.set(copy(room));
  const before = copy(entity.get());
  const projection = entity.projectAllocation(before, 'car');
  entity.captureFromDom(before, projection, 'car');
  const after = entity.get();
  assert.equal(after.lastUpdatedAt, before.lastUpdatedAt);
  assert.equal(after.allocations.car.updatedAt, before.allocations.car.updatedAt);
}

// Same car, different fields converge regardless of notification order.
{
  const { room, alice } = sampleRoom();
  const a = copy(room);
  a.settlement.carsByParticipantId[alice].dist = '71';
  a.settlement.carsByParticipantId[alice].updatedAt = 100;
  a.lastUpdatedAt = 100;
  a.lastUpdatedBy = 'client-A';
  const b = copy(room);
  b.settlement.carsByParticipantId[alice].price = '772';
  b.settlement.carsByParticipantId[alice].updatedAt = 110;
  b.lastUpdatedAt = 110;
  b.lastUpdatedBy = 'client-B';
  const afterA = sync.applyVersionedEntityPatch(room, room, a, sync.buildEntityPatch(room, a), 1);
  const final = sync.applyVersionedEntityPatch(afterA, room, b, sync.buildEntityPatch(room, b), 1);
  assert.equal(final.settlement.carsByParticipantId[alice].dist, '71');
  assert.equal(final.settlement.carsByParticipantId[alice].price, '772');
}

// Delete is authoritative: a stale participant edit cannot recreate a tombstoned identity.
{
  const { room, alice } = sampleRoom();
  entity.set(copy(room));
  entity.deleteParticipant(alice, { deletedAt: 200 });
  const deleted = copy(entity.get());
  deleted.lastUpdatedAt = 200;
  deleted.lastUpdatedBy = 'client-B';
  const afterDelete = sync.applyVersionedEntityPatch(room, room, deleted, sync.buildEntityPatch(room, deleted), 1);
  const staleEdit = copy(room);
  staleEdit.participants[alice].memo = 'stale edit';
  staleEdit.participants[alice].updatedAt = 300;
  staleEdit.lastUpdatedAt = 300;
  staleEdit.lastUpdatedBy = 'client-A';
  const final = sync.applyVersionedEntityPatch(afterDelete, room, staleEdit, sync.buildEntityPatch(room, staleEdit), 2);
  assert.equal(final.participants[alice], undefined);
  assert.ok(final.participantTombstones[alice]);
}

// v50 boundaries: no partial remote room is painted into an active editor and no remote
// notification is converted into a new save. Explicit saves alone are durable/replayable.
const executableSync = syncSource.replace(/\/\* v49's partial modal rebase[\s\S]*?\*\//, '');
assert.doesNotMatch(executableSync, /applyRemoteSettlementWhileEditing/);
const pendingBody = executableSync.match(/function applyPendingRemoteRoomData\(\) \{([\s\S]*?)\n\}/)?.[1] || '';
assert.doesNotMatch(pendingBody, /\bsave\s*\(/);
assert.match(executableSync, /function rememberSyncOutbox/);
assert.match(executableSync, /replay that original narrow intent/);
assert.doesNotMatch(runtimeSource, /get\(offsetRef\)/);
assert.match(runtimeSource, /onValue\(offsetRef/);
assert.doesNotMatch(executableSync, /!raw\.participants/);

console.log('Collaborative sync foundation v50 contract: PASS');
