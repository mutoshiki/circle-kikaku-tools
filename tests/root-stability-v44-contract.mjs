import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const entitySource = read('assets/js/core/entity-state-v5.js');
const syncSource = read('assets/js/core/sync-controller.js');
const renderSource = read('assets/js/features/settlement/03-render.js');
const extraTemplate = read('assets/js/templates/settlement/04-extra-input-templates.js');
const dragSource = read('assets/js/features/drag-edit-view.js');
const traySource = read('assets/js/features/waiting-tray.js');
const appSource = read('assets/js/app.js');

assert.match(extraTemplate, /data-extra-field="type"[^>]*value="\$\{type\}"/, 'Carbon expense toggle host must carry the canonical value');
assert.match(renderSource, /Validation must never rebuild a valid editor/, 'valid car-save validation must preserve live Carbon controls');
assert.match(renderSource, /Missing organizer is guidance, not a save-blocking data error/, 'missing organizer must not deadlock settings save');
assert.match(dragSource, /restoreScrollAfterManualCardMutation/, 'legacy drag module may retain its internal stability helper while it remains uninitialized');
assert.doesNotMatch(appSource, /setupManualCardDrag\(\)/, 'retired allocation drag must not be initialized');
assert.doesNotMatch(traySource, /drag-transient-minimized/, 'hidden waiting pool must not retain the former transient drag-drawer state');
assert.match(traySource, /former bottom drawer, drag lifecycle and assignment settings UI are retired/, 'waiting compatibility owner must document the retired visible drag surface');

const ctx = vm.createContext({
  window: { SanpoClock: { now: () => Date.now(), isServerAligned: () => true } }, console, Date, JSON, Math, Object, Array, Set, Map, String, Number, parseInt,
  encodeURIComponent, decodeURIComponent,
  APP_SCHEMA_VERSION: 5,
  CFG: { STORE: 'test' }, roomId: 'ROOM', myClientId: 'client-A',
  safeJsonParse: JSON.parse,
  L: { getItem: () => null, setItem() {}, removeItem() {} }, J: JSON,
  isRemoteUpdate: false, dbRef: null, lastSyncedData: null, lastSyncedRevision: 0,
  pendingRemoteSettlementData: null, saveRequestVersion: 0, saveTimer: null, syncWriteInFlight: false,
  isSettlementInputProtected: () => false, isDraggingCards: false, manualCardDrag: null,
  updateStatus() {}, restore() {}, getData: () => ({}), queueMicrotask: fn => fn(),
  editLockEnabled: false, editLockPassphrase: '', editLockScopes: {}, carPlans: [], activeCarPlanId: '', lastAutoAssignLabel: '',
  rememberTrustedDevice() {}, updateEditLockButton() {}, refreshRoomTitle() {}, updateUI() {}, hideAppLoadingSkeleton() {},
  requestPassphrasePanel: async () => '', getTrustedDeviceKey: () => '', location: { reload() {} },
  set: async () => {}, update: async () => {}, onValue() {}, runTransaction: null
});
vm.runInContext(entitySource, ctx);
ctx.migrateAppData = value => ctx.window.SanpoCanonicalState.migrate(value || {});
vm.runInContext(syncSource, ctx);
const entity = ctx.window.SanpoCanonicalState;
const sync = ctx.window.SanpoEntitySyncTest;

function baseRoom() {
  let room = entity.emptyRoom();
  const aliceId = entity.ensureParticipant(room.participants, { name: 'Alice', grade: 1, updatedAt: 1 });
  const bobId = entity.ensureParticipant(room.participants, { name: 'Bob', grade: 1, updatedAt: 1 });
  const carolId = entity.ensureParticipant(room.participants, { name: 'Carol', grade: 1, updatedAt: 1 });
  room = entity.migrate(room);
  room.lastUpdatedAt = 1;
  room.lastUpdatedBy = 'base';
  room.syncClock = 0;
  return { room, aliceId, bobId, carolId };
}

// Same-field reordering: a late packet with older entity time must never revert the newer edit.
{
  const { room, aliceId } = baseRoom();
  const newer = structuredClone(room);
  newer.participants[aliceId].grade = 3;
  newer.participants[aliceId].updatedAt = 200;
  newer.lastUpdatedAt = 200;
  newer.lastUpdatedBy = 'client-B';
  const older = structuredClone(room);
  older.participants[aliceId].grade = 2;
  older.participants[aliceId].updatedAt = 100;
  older.lastUpdatedAt = 100;
  older.lastUpdatedBy = 'client-A';
  const newerPatch = sync.buildEntityPatch(room, newer);
  const olderPatch = sync.buildEntityPatch(room, older);
  let server = sync.applyVersionedEntityPatch(room, room, newer, newerPatch, 1);
  server = sync.applyVersionedEntityPatch(server, room, older, olderPatch, 1);
  assert.equal(server.participants[aliceId].grade, 3, 'older reordered participant field must be rejected');
  assert.equal(server.participants[aliceId].updatedAt, 200);
}

// Final-seat race: both edits are locally legal but canonical room must never overbook.
{
  const { room, aliceId, bobId, carolId } = baseRoom();
  const gid = 'g_car_alice';
  room.allocations.car.groups[gid] = { id: gid, ownerId: aliceId, capacity: 1, order: 0, updatedAt: 1 };
  room.allocations.car.placements[aliceId] = { kind: 'member', driver: true, groupId: gid, order: 0, updatedAt: 1 };
  room.allocations.car.placements[bobId] = { kind: 'waiting', groupId: '', order: 0, updatedAt: 1 };
  room.allocations.car.placements[carolId] = { kind: 'waiting', groupId: '', order: 1, updatedAt: 1 };
  const a = structuredClone(room);
  a.allocations.car.placements[bobId] = { kind: 'member', groupId: gid, order: 0, updatedAt: 100 };
  a.lastUpdatedAt = 100; a.lastUpdatedBy = 'client-A';
  const b = structuredClone(room);
  b.allocations.car.placements[carolId] = { kind: 'member', groupId: gid, order: 0, updatedAt: 101 };
  b.lastUpdatedAt = 101; b.lastUpdatedBy = 'client-B';
  const patchA = sync.buildEntityPatch(room, a);
  const patchB = sync.buildEntityPatch(room, b);
  let server1 = sync.applyVersionedEntityPatch(room, room, a, patchA, 1);
  server1 = sync.applyVersionedEntityPatch(server1, room, b, patchB, 1);
  let server2 = sync.applyVersionedEntityPatch(room, room, b, patchB, 1);
  server2 = sync.applyVersionedEntityPatch(server2, room, a, patchA, 1);
  for (const server of [server1, server2]) {
    const members = Object.entries(server.allocations.car.placements)
      .filter(([id, p]) => id !== aliceId && p?.kind === 'member' && p.groupId === gid);
    assert.equal(members.length, 1, 'capacity invariant must hold after concurrent last-seat claims');
  }
  assert.deepEqual(server1.allocations.car.placements[bobId].kind, server2.allocations.car.placements[bobId].kind, 'capacity race must converge independent of delivery order');
  assert.deepEqual(server1.allocations.car.placements[carolId].kind, server2.allocations.car.placements[carolId].kind, 'capacity race must converge independent of delivery order');
}

console.log('Root stability v44 contract: PASS');
