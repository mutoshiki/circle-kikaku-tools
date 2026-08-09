import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const entitySource = fs.readFileSync(new URL('../assets/js/core/entity-state-v5.js', import.meta.url), 'utf8');
const entityContext = vm.createContext({ window: {}, console, Date, JSON, Math, Object, Array, Set, Map, String, Number, parseInt });
vm.runInContext(`${entitySource}\n;globalThis.__entity = window.SanpoCanonicalState;`, entityContext);
const entity = entityContext.__entity;

const syncSource = fs.readFileSync(new URL('../assets/js/core/sync-controller.js', import.meta.url), 'utf8');
const sheet = fs.readFileSync(new URL('../assets/js/features/sheet/00-data-sync.js', import.meta.url), 'utf8');
const context = {
  console, window: {}, document: {}, CFG: { STORE: 'test' }, roomId: 'ROOM', APP_SCHEMA_VERSION: 5,
  myClientId: 'client-local', L: { getItem: () => null, setItem() {}, removeItem() {} }, J: JSON,
  safeJsonParse: (value, fallback = null) => { try { return JSON.parse(value); } catch { return fallback; } },
  migrateAppData: value => entity.migrate(value),
  lastSyncedData: null, lastSyncedRevision: 0, pendingRemoteSettlementData: null, pendingRemoteRoomData: null,
  syncWriteInFlight: false, saveTimer: null, saveRequestVersion: 0, isRemoteUpdate: false, dbRef: null,
  lastUpdatedAt: 0, currentView: 'list', isSettlementInputProtected: () => false, isDraggingCards: false, manualCardDrag: null,
  queueMicrotask: fn => fn(), setTimeout, clearTimeout,
  $: () => ({ value: '', innerHTML: '' }), byId: () => ({ classList: { contains: () => false }, dataset: {} }),
  getData: () => ({}), restore() {}, updateStatus() {}, rememberTrustedDevice() {}, updateEditLockButton() {},
  refreshRoomTitle() {}, updateUI() {}, hideAppLoadingSkeleton() {}, onValue() {}, set: async () => {}, update: async () => {},
  requestPassphrasePanel: async () => '', getTrustedDeviceKey: () => 'trusted', showAppNotice() {}, location: { reload() {} },
  isProcessingQueue: false, editLockEnabled: false, editLockPassphrase: '', editLockScopes: {}, carPlans: [], activeCarPlanId: '', lastAutoAssignLabel: ''
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(`${syncSource}\n;globalThis.__syncTest = { buildConcurrentRoomMerge, buildEntityPatch, applyEntityPatchToObject };`, context);
const { buildConcurrentRoomMerge } = context.__syncTest;

const legacy = {
  schemaVersion: 4,
  roomName: '企画',
  activeCarPlanId: 'plan-car',
  carPlans: [
    { id: 'plan-car', templateType: 'car', name: '車割', waiting: [{ name: 'A' }, { name: 'B' }], cars: [] },
    { id: 'plan-team', templateType: 'team', name: '班割', waiting: [{ name: 'A' }, { name: 'B' }], cars: [] }
  ],
  settlement: {
    cars: {
      A: { dist: '100', eco: '10', price: '160', extras: [] },
      B: { dist: '80', eco: '12', price: '160', extras: [] }
    },
    paid: { A: false, B: false }
  },
  overview: { memo: '' }
};
const base = entity.migrate(legacy);
const aId = entity.findParticipantIdByName(base.participants, 'A');
const bId = entity.findParticipantIdByName(base.participants, 'B');

// Historical v40 guarantee, expressed against the current canonical schema:
// two phones editing different settlement entities must both survive.
const remoteCarA = structuredClone(base);
remoteCarA.settlement.carsByParticipantId[aId].dist = '150';
remoteCarA.lastUpdatedBy = 'client-a';
const localCarB = structuredClone(base);
localCarB.settlement.carsByParticipantId[bId].price = '170';
localCarB.lastUpdatedBy = 'client-b';
localCarB.lastUpdatedAt = 1000;
const mergedCars = buildConcurrentRoomMerge(remoteCarA, base, localCarB);
assert.equal(mergedCars.settlement.carsByParticipantId[aId].dist, '150');
assert.equal(mergedCars.settlement.carsByParticipantId[bId].price, '170');

// Payment flags are entity-keyed rather than whole-map last-writer-wins.
const remotePaid = structuredClone(base);
remotePaid.settlement.paidByParticipantId[aId] = true;
const localPaid = structuredClone(base);
localPaid.settlement.paidByParticipantId[bId] = true;
localPaid.lastUpdatedAt = 1001;
const mergedPaid = buildConcurrentRoomMerge(remotePaid, base, localPaid);
assert.equal(mergedPaid.settlement.paidByParticipantId[aId], true);
assert.equal(mergedPaid.settlement.paidByParticipantId[bId], true);

// Deletion is authoritative. A stale settlement edit may update unrelated B, but A cannot reappear.
const remoteDelete = structuredClone(base);
delete remoteDelete.participants[aId];
remoteDelete.participantTombstones ||= {};
remoteDelete.participantTombstones[aId] = { deletedAt: 2000 };
delete remoteDelete.allocations.car.placements[aId];
delete remoteDelete.allocations.team.placements[aId];
const staleSettlementEdit = structuredClone(base);
staleSettlementEdit.settlement.carsByParticipantId[bId].eco = '14';
staleSettlementEdit.lastUpdatedAt = 1002;
const mergedDelete = buildConcurrentRoomMerge(remoteDelete, base, staleSettlementEdit);
assert.equal(mergedDelete.participants[aId], undefined);
assert.equal(mergedDelete.settlement.carsByParticipantId[bId].eco, '14');

// No noisy collaboration popup and shared-sheet writes use the canonical queue.
assert.doesNotMatch(syncSource, /他の人が(?:更新|編集)しました/);
assert.doesNotMatch(sheet, /update\(dbRef\s*,\s*payload\)/);
assert.match(sheet, /queueRemoteSnapshotSave\(snapshot,\s*80\)/);

console.log('PASS multi-user concurrent sync contract (canonical schema)');
