import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const entitySource = fs.readFileSync(new URL('../assets/js/core/entity-state-v5.js', import.meta.url), 'utf8');
const entityContext = vm.createContext({ window: { SanpoClock: { now: () => 100 } }, console, Date, JSON, Math, Object, Array, Set, Map, String, Number, encodeURIComponent, decodeURIComponent });
vm.runInContext(`${entitySource}\n;globalThis.E = window.SanpoCanonicalState`, entityContext);
const E = entityContext.E;
const syncSource = fs.readFileSync(new URL('../assets/js/core/sync-controller.js', import.meta.url), 'utf8');
const syncContext = vm.createContext({
    window: { SanpoCanonicalState: E, SanpoClock: { now: () => 100, isServerAligned: () => true } },
    console, Date, JSON, Math, Object, Array, Set, Map, String, Number, encodeURIComponent, decodeURIComponent,
    APP_SCHEMA_VERSION: 6, CFG: { STORE: 'test' }, roomId: 'ROOM', myClientId: 'deviceA',
    migrateAppData: value => E.migrate(value || {}), safeJsonParse: JSON.parse,
    L: { getItem: () => null, setItem() {}, removeItem() {} }, J: JSON,
    isRemoteUpdate: false, dbRef: null, lastSyncedData: null, lastSyncedRevision: 0,
    pendingRemoteSettlementData: null, pendingRemoteRoomData: null, saveRequestVersion: 0, saveTimer: null,
    syncWriteInFlight: false, isSettlementInputProtected: () => false, isDraggingCards: false,
    manualCardDrag: null, manualSheetDrag: null, isProcessingQueue: false, updateStatus() {}, restore() {},
    getData: () => ({}), queueMicrotask: fn => fn(), requestAnimationFrame: fn => fn(),
    editLockEnabled: false, editLockPassphrase: '', editLockScopes: {}, carPlans: [], activeCarPlanId: '', lastAutoAssignLabel: '',
    rememberTrustedDevice() {}, updateEditLockButton() {}, refreshRoomTitle() {}, updateUI() {}, hideAppLoadingSkeleton() {},
    requestPassphrasePanel: async () => '', getTrustedDeviceKey: () => '', location: { reload() {} }, set: async () => {}, update: async () => {}, onValue() {}
});
vm.runInContext(`${syncSource}\n;globalThis.S = window.SanpoEntitySyncTest`, syncContext);
const S = syncContext.S;
const clone = structuredClone;

assert.match(syncSource, /MAX_SYNC_OPERATION_JOURNAL = 256/, 'operation journal must be bounded');
assert.match(syncSource, /Firebase Realtime Database transaction support is required/, 'unsafe blind-write fallback must stay disabled');
assert.match(syncSource, /isUnsupportedRemoteSchema/, 'future schema writes must be gated');

function room() {
    const value = E.emptyRoom();
    const id = E.ensureParticipant(value.participants, { name: '初期参加者', grade: 1 });
    E.ensureAllParticipantsPlaced(value.allocations.car, value.participants);
    E.ensureAllParticipantsPlaced(value.allocations.team, value.participants);
    value.revision = 7;
    value.lastUpdatedAt = 50;
    value.lastUpdatedBy = 'seed';
    return { room: E.migrate(value), id };
}

const { room: base, id: originalId } = room();
const local = clone(base);
const addedId = E.ensureParticipant(local.participants, { name: '再送追加', grade: 2 }, '', local.participantTombstones);
E.ensureAllParticipantsPlaced(local.allocations.car, local.participants);
E.ensureAllParticipantsPlaced(local.allocations.team, local.participants);
local.lastUpdatedAt = 101;
local.lastUpdatedBy = 'deviceA';
const addPatch = S.buildEntityPatch(base, local);

const first = S.applyVersionedEntityPatch(base, base, local, addPatch, 1, 'op_deviceA_1');
const replay = S.applyVersionedEntityPatch(first, base, local, addPatch, 1, 'op_deviceA_1');
assert.equal(Object.keys(replay.participants).length, 2, 'same operation must not double-add');
assert.equal(replay.revision, first.revision, 'same operation must not advance revision twice');
assert.ok(replay.syncOperations.op_deviceA_1, 'operation acknowledgement must persist');

// Deletion wins over stale save, even if delayed packet has a newer wall-clock value.
const deleted = clone(first);
deleted.participantTombstones[originalId] = { deletedAt: 200 };
delete deleted.participants[originalId];
for (const type of ['car', 'team']) delete deleted.allocations[type].placements[originalId];
const deletePatch = S.buildEntityPatch(first, deleted);
const afterDelete = S.applyVersionedEntityPatch(first, first, deleted, deletePatch, 2, 'op_deviceB_delete');
const staleSave = clone(first);
staleSave.participants[originalId].name = '古い端末の保存';
staleSave.participants[originalId].updatedAt = 999999;
staleSave.lastUpdatedAt = 999999;
const afterStaleSave = S.applyVersionedEntityPatch(afterDelete, first, staleSave, S.buildEntityPatch(first, staleSave), 3, 'op_old_save');
assert.equal(afterStaleSave.participants[originalId], undefined, 'tombstone must prevent resurrection');

// Reset generation rejects a queued operation captured before reset.
const reset = E.emptyRoom();
reset.resetGeneration = Number(afterStaleSave.resetGeneration || 0) + 1;
reset.revision = afterStaleSave.revision + 1;
reset.lastUpdatedAt = 300;
reset.lastUpdatedBy = 'reset-device';
const afterReset = E.migrate(reset);
const afterStaleReplay = S.applyVersionedEntityPatch(afterReset, first, local, addPatch, 4, 'op_before_reset');
assert.equal(Object.keys(afterStaleReplay.participants).length, 0, 'pre-reset outbox must not recreate participants');
assert.equal(afterStaleReplay.resetGeneration, afterReset.resetGeneration, 'reset generation must not regress');
assert.equal(afterStaleReplay.revision, afterReset.revision, 'stale replay must not advance revision');

// Eight-hours-offline client carries full old allocation/settlement state; reset generation
// still makes its delayed packet inert without relying on operation-journal retention.
const eightHoursOld = clone(local);
eightHoursOld.lastUpdatedAt = 1;
eightHoursOld.lastUpdatedBy = 'offline-eight-hours';
const afterLongOfflineReplay = S.applyVersionedEntityPatch(afterReset, first, eightHoursOld, S.buildEntityPatch(first, eightHoursOld), 5, 'op_eight_hours_old');
assert.equal(Object.keys(afterLongOfflineReplay.participants).length, 0, 'long-offline packet must not restore cars, teams or settlement');
assert.equal(afterLongOfflineReplay.revision, afterReset.revision, 'long-offline replay must be revision no-op');

// Journal compaction is bounded and removes oldest acknowledgements deterministically.
let journalRoom = first;
for (let index = 0; index < 300; index += 1) {
    const next = clone(journalRoom);
    next.roomName = `journal-${index}`;
    next.lastUpdatedAt = 1000 + index;
    next.lastUpdatedBy = 'journal-client';
    journalRoom = S.applyVersionedEntityPatch(journalRoom, journalRoom, next, S.buildEntityPatch(journalRoom, next), index + 10, `op_journal_${index}`);
}
assert.equal(Object.keys(journalRoom.syncOperations).length, 256, 'operation journal must remain bounded');
assert.equal(journalRoom.syncOperations.op_journal_0, undefined, 'oldest operation acknowledgement must be compacted');
assert.ok(journalRoom.syncOperations.op_journal_299, 'newest operation acknowledgement must remain');
assert.equal(S.isExpiredSyncOutbox({ createdAt: 1 }, 24 * 60 * 60 * 1000 + 2), true, 'expired outbox must be discarded');
assert.equal(S.isPermanentSyncError({ code: 'PERMISSION_DENIED' }), true, 'Rules rejection must be permanent');

// Canonicalization enforces one placement and capacity even under malformed concurrent input.
const overfull = clone(base);
const gid = 'g_capacity';
overfull.allocations.car.groups[gid] = { id: gid, ownerId: addedId, capacity: 1, order: 0, updatedAt: 1 };
overfull.participants[addedId] = { id: addedId, name: '別参加者', updatedAt: 1 };
overfull.allocations.car.placements[addedId] = { kind: 'driver', groupId: gid, order: 0, updatedAt: 1 };
overfull.allocations.car.placements[originalId] = { kind: 'member', groupId: gid, order: 1, updatedAt: 1 };
const normalized = E.migrate(overfull);
const memberCount = Object.values(normalized.allocations.car.placements).filter(p => p.kind === 'member' && p.groupId === gid).length;
assert.ok(memberCount <= 1, 'group capacity must hold after normalization');
assert.equal(new Set(Object.keys(normalized.allocations.car.placements)).size, Object.keys(normalized.allocations.car.placements).length, 'one placement per participant key');

assert.equal(S.isUnsupportedRemoteSchema({ schemaVersion: 7 }), true, 'future schema must be rejected by current client');
assert.equal(E.migrate({ ...base, schemaVersion: 5 }).schemaVersion, 6, 'v5 canonical room must upgrade to v6');

console.log('Sync protocol v68 contract: PASS');
