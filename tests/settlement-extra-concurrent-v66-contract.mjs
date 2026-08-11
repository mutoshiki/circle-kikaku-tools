import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const entitySource = read('assets/js/core/entity-state-v5.js');
const syncSource = read('assets/js/core/sync-controller.js');
const context = vm.createContext({
  window: { SanpoClock: { now: () => 1000, isServerAligned: () => true } },
  console, Date, JSON, Math, Object, Array, Set, Map, String, Number, parseInt, encodeURIComponent, decodeURIComponent,
  APP_SCHEMA_VERSION: 5, CFG: { STORE: 'test' }, roomId: 'R', myClientId: 'client-A',
  safeJsonParse: JSON.parse, L: { getItem: () => null, setItem() {}, removeItem() {} }, J: JSON,
  isRemoteUpdate: false, dbRef: null, lastSyncedData: null, lastSyncedRevision: 0,
  pendingRemoteSettlementData: null, pendingRemoteRoomData: null, saveRequestVersion: 0, saveTimer: null,
  syncWriteInFlight: false, isSettlementInputProtected: () => false, isDraggingCards: false,
  manualCardDrag: null, manualSheetDrag: null, isProcessingQueue: false,
  updateStatus() {}, restore() {}, getData: () => ({}), queueMicrotask: fn => fn(), requestAnimationFrame: fn => fn(),
  editLockEnabled: false, editLockPassphrase: '', editLockScopes: {}, carPlans: [], activeCarPlanId: '', lastAutoAssignLabel: '',
  rememberTrustedDevice() {}, updateEditLockButton() {}, refreshRoomTitle() {}, updateUI() {}, hideAppLoadingSkeleton() {},
  requestPassphrasePanel: async () => '', getTrustedDeviceKey: () => '', location: { reload() {} }, set: async () => {}, update: async () => {}, onValue() {}
});
vm.runInContext(entitySource, context);
context.migrateAppData = value => context.window.SanpoCanonicalState.migrate(value || {});
vm.runInContext(syncSource, context);
const { mergeConcurrentSettlementExtras } = context.window.SanpoEntitySyncTest;
const sync = context.window.SanpoEntitySyncTest;
const entity = context.window.SanpoCanonicalState;

// Two editors add different expenses to same car from same base. Both survive.
{
  const base = [{ id: 'fuel', name: 'Gas', amount: '1000', type: 'split' }];
  const local = [...base, { id: 'parking', name: 'Parking', amount: '500', type: 'club' }];
  const remote = [...base, { id: 'toll', name: 'Toll', amount: '800', type: 'split' }];
  const merged = mergeConcurrentSettlementExtras(base, remote, local, true, 'car-a');
  assert.equal(JSON.stringify(merged.map(extra => extra.id)), JSON.stringify(['fuel', 'parking', 'toll']));
}

// Actual transaction path: two stale devices append fees and transaction result contains both.
{
  const room = entity.emptyRoom();
  const driverId = entity.ensureParticipant(room.participants, { name: 'Driver' });
  room.settlement = { carsByParticipantId: { [driverId]: { extras: [{ id: 'fuel', name: 'Gas', amount: '1000', type: 'split' }] } } };
  const base = entity.migrate(room);
  const remoteEdit = structuredClone(base);
  remoteEdit.settlement.carsByParticipantId[driverId].extras.push({ id: 'toll', name: 'Toll', amount: '800', type: 'split' });
  remoteEdit.lastUpdatedAt = 200;
  remoteEdit.lastUpdatedBy = 'device-B';
  let server = sync.applyVersionedEntityPatch(base, base, remoteEdit, sync.buildEntityPatch(base, remoteEdit), 1);
  const localEdit = structuredClone(base);
  localEdit.settlement.carsByParticipantId[driverId].extras.push({ id: 'parking', name: 'Parking', amount: '500', type: 'club' });
  localEdit.lastUpdatedAt = 300;
  localEdit.lastUpdatedBy = 'device-A';
  server = sync.applyVersionedEntityPatch(server, base, localEdit, sync.buildEntityPatch(base, localEdit), 1);
  assert.equal(JSON.stringify(server.settlement.carsByParticipantId[driverId].extras.map(extra => extra.id)), JSON.stringify(['fuel', 'parking', 'toll']));
}

// Different fields of same expense merge; only same-field conflicts use transaction order.
{
  const base = [{ id: 'fee', name: 'Old name', amount: '100', type: 'split' }];
  const local = [{ id: 'fee', name: 'Old name', amount: '120', type: 'split' }];
  const remote = [{ id: 'fee', name: 'New name', amount: '100', type: 'split' }];
  const merged = mergeConcurrentSettlementExtras(base, remote, local, true, 'car-a');
  assert.equal(JSON.stringify(merged), JSON.stringify([{ id: 'fee', name: 'New name', amount: '120', type: 'split' }]));
}

// Legacy records gain deterministic IDs before their first concurrent save.
{
  const room = context.window.SanpoCanonicalState.emptyRoom();
  const driverId = context.window.SanpoCanonicalState.ensureParticipant(room.participants, { name: 'Driver' });
  room.settlement = { carsByParticipantId: { [driverId]: { extras: [{ name: 'Legacy', amount: '300', type: 'split' }] } } };
  const migrated = context.window.SanpoCanonicalState.migrate(room);
  assert.match(migrated.settlement.carsByParticipantId[driverId].extras[0].id, /^x_/);
}

console.log('Settlement concurrent extras v66: PASS');
