import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const remoteGuard = read('assets/js/core/remote-guard.js');
const syncSource = read('assets/js/core/sync-controller.js');
const entitySource = read('assets/js/core/entity-state-v5.js');
const modalSource = read('assets/js/core/modal-controller.js');
const renderSource = read('assets/js/features/settlement/03-render.js');
const batchSource = read('assets/js/features/batch-import.js');
const dragSource = read('assets/js/features/drag-edit-view.js');
const autoAssignSource = read('assets/js/features/auto-assign.js');
const index = read('index.html');

assert.match(remoteGuard, /isCollaborativeEditModalOpen/, 'remote guard protects open write modals');
assert.match(remoteGuard, /pointerTransactionDepth/, 'remote guard covers pointerdown -> click lifecycle');
assert.match(syncSource, /window\.SanpoRemoteGuard\?\.isBusy/, 'sync controller consults the shared UI transaction guard');
assert.match(syncSource, /function captureRemotePaintViewport/, 'remote repaint captures viewport state');
assert.match(syncSource, /function restoreRemotePaintViewport/, 'remote repaint restores viewport state');
assert.match(syncSource, /Math\.max\(baseClock, remoteClock\) \+ 1/, 'stale clients allocate a fresh remote Lamport clock');
assert.match(syncSource, /bothServerAligned/, 'same-path conflict only trusts timestamps after Firebase server-time alignment');
assert.doesNotMatch(syncSource.match(/const ROOM_META_FIELDS = \[([\s\S]*?)\];/)?.[1] || '', /activeAllocationType|trayMinimized/, 'device presentation state must not be room-synced');
assert.match(entitySource, /DOM is a projection, never the participant master/, 'DOM absence is not implicit deletion');
assert.match(entitySource, /function deleteCanonicalParticipant/, 'participant deletion is an explicit canonical mutation');
assert.match(batchSource, /batchOpeningCanonicalSnapshot/, 'participant registration records its opening collaboration base');
assert.match(batchSource, /three-way intent editor/i, 'participant registration applies user intent instead of replacing the room');
assert.match(batchSource, /__suspendActiveDomPlanSync = true/, 'batch submit saves canonical state without re-sampling the modal-underlay DOM');
assert.match(renderSource, /renderSettlementAfterModalCommit/, 'settlement submit renders only after Carbon modal close');
assert.match(dragSource, /BEFORE seat hit-testing/, 'collapsed waiting tray is resolved before underlying seat hit-testing');
assert.match(index, /remote-guard\.js\?v=collab-interaction-delete-v47/, 'remote guard is cache-busted');
for (const path of [
  'core/runtime.js', 'core/storage.js', 'core/settlement-edit-guard.js', 'core/entity-state-v5.js',
  'core/sync-controller.js', 'core/data-state.js', 'core/modal-controller.js',
  'features/settlement/03-render.js', 'core/remote-guard.js', 'features/waiting-tray.js',
  'features/sheet/00-data-sync.js', 'features/drag-edit-view.js', 'features/auto-assign.js',
  'features/person-menu.js', 'features/batch-import.js', 'features/sample-data-history.js',
  'features/events/01-core-startup-events.js', 'features/events/04-settlement-input-events.js'
]) {
  const marker = `${path}?v=`;
  const start = index.indexOf(marker);
  assert.notEqual(start, -1, `${path} is referenced`);
  const tail = index.slice(start, start + marker.length + 120);
  assert.match(tail, /collab-interaction-delete-v47|settlement-concurrent-save-v48|settlement-concurrent-save-v49|collaborative-sync-foundation-v50|settlement-negative-extra-save-v51|collection-carbon-v65|settlement-extra-concurrent-v66|sync-reliability-v67|sync-protocol-v68/, `${path} is cache-busted as a compatible collaborative build`);
}
assert.doesNotMatch(syncSource, /onValue\(dbRef,[\s\S]{0,160}if \(isProcessingQueue\) return/, 'gender queue must queue remote snapshots, never drop them');
assert.match(syncSource, /\|\| !!isProcessingQueue/, 'gender detection participates in the remote UI transaction guard');
assert.match(autoAssignSource, /SanpoRemoteGuard\?\.requestPendingApply/, 'gender queue releases queued remote snapshots after its final save');
assert.match(batchSource, /openingByName\.get\(key\)[\s\S]{0,240}canonical\.participants\?\.\[openingEntry\.id\]/, 'participant registration resolves unchanged driver lines by opening participant ID across remote renames');
assert.match(remoteGuard, /'appConfirmModal'/, 'delete confirmation is protected as a collaborative write transaction');
assert.match(remoteGuard, /function isPersonMenuOpen/, 'open person menu blocks remote DOM repaint');
assert.match(remoteGuard, /inPersonInteraction[\s\S]{0,420}markLocalEditing\(650\)/, 'person pointerdown is bridged until Carbon reflects menu open state');
assert.match(entitySource, /if \(preferred && tombstones\[preferred\]\) return '';/, 'a stale explicit tombstoned DOM identity cannot be reminted');
assert.match(batchSource, /\[\.\.\.m, \.\.\.g1, \.\.\.g2, \.\.\.g3, \.\.\.g4\]\.forEach/, 'participant roster excludes the driver-role field');
assert.doesNotMatch(batchSource, /\[\.\.\.m, \.\.\.g1, \.\.\.g2, \.\.\.g3, \.\.\.g4, \.\.\.d\]\.forEach/, 'driver field alone cannot preserve a removed participant');
const waitingTraySource = read('assets/js/features/waiting-tray.js');
const waitingDragCss = read('assets/css/cars-members-tray/drag-drop/01-card-drag.css');
assert.match(waitingTraySource, /ここにドロップして未割り当てに戻す/, 'waiting tray announces the active return drop target');
assert.match(waitingTraySource, /wasNear !== touchingClosedStrip[\s\S]{0,100}updateTrayToggleLabel/, 'waiting tray label changes exactly when pointer enters/leaves the drop strip');
assert.match(waitingDragCss, /#bottom-tray\.is-drop-near #tray-handle[\s\S]{0,180}box-shadow:[^;]*var\(--drop-accent\)/, 'waiting tray hover has a stronger visual target state');
assert.match(index, /01-card-drag\.css\?v=collab-interaction-delete-v47/, 'waiting tray drag CSS is cache-busted with v47');

const ctx = vm.createContext({
  window: {}, SanpoClock: { now: () => Date.now(), isServerAligned: () => true }, console, Date, JSON, Math, Object, Array, Set, Map, String, Number, parseInt,
  encodeURIComponent, decodeURIComponent,
  APP_SCHEMA_VERSION: 6,
  CFG: { STORE: 'test' }, roomId: 'ROOM', myClientId: 'client-A',
  safeJsonParse: JSON.parse,
  L: { getItem: () => null, setItem() {}, removeItem() {} }, J: JSON,
  isRemoteUpdate: false, dbRef: null, lastSyncedData: null, lastSyncedRevision: 0,
  pendingRemoteSettlementData: null, saveRequestVersion: 0, saveTimer: null, syncWriteInFlight: false,
  isSettlementInputProtected: () => false, isDraggingCards: false, manualCardDrag: null, manualSheetDrag: null,
  updateStatus() {}, restore() {}, getData: () => ({}), queueMicrotask: fn => fn(), requestAnimationFrame: fn => fn(), setTimeout: fn => { fn(); return 1; }, clearTimeout() {},
  byId: () => null, currentView: 'list', location: { reload() {} },
  editLockEnabled: false, editLockPassphrase: '', editLockScopes: {}, carPlans: [], activeCarPlanId: '', lastAutoAssignLabel: '',
  rememberTrustedDevice() {}, updateEditLockButton() {}, refreshRoomTitle() {}, updateUI() {}, hideAppLoadingSkeleton() {},
  requestPassphrasePanel: async () => '', getTrustedDeviceKey: () => '', set: async () => {}, update: async () => {}, onValue() {},
});
ctx.window = ctx;
ctx.window.SanpoClock = ctx.SanpoClock;
ctx.window.scrollX = 0; ctx.window.scrollY = 0; ctx.window.scrollTo = () => {};
vm.runInContext(entitySource, ctx);
ctx.migrateAppData = value => ctx.window.SanpoCanonicalState.migrate(value || {});
vm.runInContext(syncSource, ctx);
const entity = ctx.window.SanpoCanonicalState;
const sync = ctx.window.SanpoEntitySyncTest;

function roomWithAliceBob() {
  const room = entity.emptyRoom();
  const aliceId = entity.ensureParticipant(room.participants, { name: 'Alice', grade: 1, updatedAt: 10 });
  const bobId = entity.ensureParticipant(room.participants, { name: 'Bob', grade: 1, updatedAt: 10 });
  room.allocations.car.placements[aliceId] = { kind: 'waiting', groupId: '', order: 0, updatedAt: 10 };
  room.allocations.car.placements[bobId] = { kind: 'waiting', groupId: '', order: 1, updatedAt: 10 };
  room.lastUpdatedAt = 10;
  room.lastUpdatedBy = 'base';
  return { room: entity.migrate(room), aliceId, bobId };
}

// A later action from a stale client must not be silently dropped.
{
  const { room, aliceId } = roomWithAliceBob();
  const remoteEdit = structuredClone(room);
  remoteEdit.participants[aliceId].grade = 2;
  remoteEdit.participants[aliceId].updatedAt = 200;
  remoteEdit.lastUpdatedAt = 200;
  remoteEdit.lastUpdatedBy = 'client-B';
  let server = sync.applyVersionedEntityPatch(room, room, remoteEdit, sync.buildEntityPatch(room, remoteEdit), 1);

  const staleButNewer = structuredClone(room);
  staleButNewer.participants[aliceId].grade = 3;
  staleButNewer.participants[aliceId].updatedAt = 300;
  staleButNewer.lastUpdatedAt = 300;
  staleButNewer.lastUpdatedBy = 'client-A';
  server = sync.applyVersionedEntityPatch(server, room, staleButNewer, sync.buildEntityPatch(room, staleButNewer), 2);
  assert.equal(server.participants[aliceId].grade, 3, 'newer user action from stale base must sync');
}

// But a reordered older packet must still be rejected.
{
  const { room, aliceId } = roomWithAliceBob();
  const newer = structuredClone(room);
  newer.participants[aliceId].grade = 4;
  newer.participants[aliceId].updatedAt = 400;
  newer.lastUpdatedAt = 400; newer.lastUpdatedBy = 'client-B';
  let server = sync.applyVersionedEntityPatch(room, room, newer, sync.buildEntityPatch(room, newer), 1);
  const older = structuredClone(room);
  older.participants[aliceId].grade = 2;
  older.participants[aliceId].updatedAt = 100;
  older.lastUpdatedAt = 100; older.lastUpdatedBy = 'client-A';
  server = sync.applyVersionedEntityPatch(server, room, older, sync.buildEntityPatch(room, older), 9);
  assert.equal(server.participants[aliceId].grade, 4, 'late old packet cannot revert a newer edit');
}

// Sampling an unchanged projection must not manufacture entity writes.
{
  const { room, aliceId } = roomWithAliceBob();
  entity.set(room);
  const beforeParticipantTime = entity.get().participants[aliceId].updatedAt;
  const beforePlacementTime = entity.get().allocations.car.placements[aliceId].updatedAt;
  const projection = entity.projectAllocation(entity.get(), 'car');
  entity.captureFromDom(entity.get(), projection, 'car');
  assert.equal(entity.get().participants[aliceId].updatedAt, beforeParticipantTime, 'unchanged participant timestamp is stable');
  assert.equal(entity.get().allocations.car.placements[aliceId].updatedAt, beforePlacementTime, 'unchanged placement timestamp is stable');
}

// A missing rendered card is not deletion; explicit deletion is tombstoned.
{
  const { room, aliceId } = roomWithAliceBob();
  entity.set(room);
  const projection = entity.projectAllocation(entity.get(), 'car');
  entity.captureFromDom(entity.get(), { ...projection, waiting: projection.waiting.filter(p => p.participantId !== aliceId) }, 'car');
  assert.ok(entity.get().participants[aliceId], 'transient missing card does not delete Alice');
  entity.deleteParticipant(aliceId);
  assert.equal(entity.get().participants[aliceId], undefined);
  assert.ok(entity.get().participantTombstones[aliceId]);
}

// A stale card/plan carrying a deleted explicit ID must be ignored rather than
// resurrected under a newly generated suffix ID.
{
  const { room, aliceId } = roomWithAliceBob();
  entity.set(room);
  const staleAlice = entity.projectAllocation(entity.get(), 'car').waiting.find(p => p.participantId === aliceId);
  entity.deleteParticipant(aliceId);
  entity.captureFromDom(entity.get(), { cars: [], waiting: [staleAlice] }, 'car');
  assert.equal(Object.values(entity.get().participants).some(p => p.name === 'Alice'), false, 'stale DOM card cannot resurrect Alice');
  entity.applyProjectedPlan(entity.get(), { name: 'Car', cars: [], waiting: [staleAlice] }, 'car');
  assert.equal(Object.values(entity.get().participants).some(p => p.name === 'Alice'), false, 'stale projected plan cannot resurrect Alice');
}


// Remote snapshots arriving during the local gender queue are retained, never discarded.
{
  const { room, aliceId } = roomWithAliceBob();
  const remote = structuredClone(room);
  remote.participants[aliceId].grade = 4;
  remote.participants[aliceId].updatedAt = 777;
  remote.lastUpdatedAt = 777; remote.lastUpdatedBy = 'client-B';
  vm.runInContext(`dbRef = {}; lastSyncedData = null; pendingRemoteRoomData = null; pendingRemoteSettlementData = null;
    isProcessingQueue = true; onValue = (_ref, cb) => { globalThis.__roomOnValue = cb; }; load();`, ctx);
  ctx.__remoteForQueue = remote;
  vm.runInContext(`__roomOnValue({ val: () => __remoteForQueue });`, ctx);
  const queued = vm.runInContext('pendingRemoteRoomData', ctx);
  assert.equal(queued.participants[aliceId].grade, 4, 'remote snapshot is queued while gender processing is active');
  vm.runInContext('isProcessingQueue = false; dbRef = null;', ctx);
}

// Device-only presentation state must never create a Firebase domain patch.
{
  const { room } = roomWithAliceBob();
  const local = structuredClone(room);
  local.activeAllocationType = 'team';
  local.trayMinimized = !room.trayMinimized;
  const patch = sync.buildEntityPatch(room, local);
  assert.equal(Object.keys(patch).some(path => path === 'activeAllocationType' || path === 'trayMinimized'), false);
}

// When server time is unavailable, a bad client wall clock cannot dominate transaction order.
{
  const newerTransaction = { clock: 20, time: 100, serverAligned: false, clientId: 'B', seq: 1 };
  const skewedOldTransaction = { clock: 19, time: 999999999, serverAligned: false, clientId: 'A', seq: 99 };
  assert.equal(sync.compareSyncVersions(newerTransaction, skewedOldTransaction) > 0, true);
}

console.log('Collaborative interaction + deletion sync v47 contract: PASS');
