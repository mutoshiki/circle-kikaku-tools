import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const syncPath = path.join(root, 'assets/js/core/sync-controller.js');
const sheetPath = path.join(root, 'assets/js/features/sheet/00-data-sync.js');
const source = fs.readFileSync(syncPath, 'utf8');
const sheet = fs.readFileSync(sheetPath, 'utf8');

const context = {
  console,
  window: {},
  document: {},
  CFG: { STORE: 'test' },
  roomId: 'ROOM',
  APP_SCHEMA_VERSION: 4,
  myClientId: 'client-local',
  L: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  J: JSON,
  safeJsonParse: (value, fallback = null) => { try { return JSON.parse(value); } catch { return fallback; } },
  migrateAppData: x => x,
  lastSyncedData: null,
  lastSyncedRevision: 0,
  pendingRemoteSettlementData: null,
  syncWriteInFlight: false,
  saveTimer: null,
  saveRequestVersion: 0,
  isRemoteUpdate: false,
  dbRef: null,
  lastUpdatedAt: 0,
  currentView: 'list',
  isSettlementInputProtected: () => false,
  queueMicrotask: fn => fn(),
  setTimeout,
  clearTimeout,
  $: () => ({ value: '', innerHTML: '' }),
  byId: () => ({ classList: { contains: () => false }, dataset: {} }),
  getData: () => ({}),
  restore: () => {},
  updateStatus: () => {},
  rememberTrustedDevice: () => {},
  updateEditLockButton: () => {},
  refreshRoomTitle: () => {},
  updateUI: () => {},
  renderCarPlanSwitcher: () => {},
  updateLastAutoAssignCondition: () => {},
  hideAppLoadingSkeleton: () => {},
  onValue: () => {},
  set: () => Promise.resolve(),
  update: () => Promise.resolve(),
  requestPassphrasePanel: async () => '',
  getTrustedDeviceKey: () => 'trusted',
  showAppNotice: () => {},
  location: { reload: () => {} },
  isProcessingQueue: false,
  editLockEnabled: false,
  editLockPassphrase: '',
  editLockScopes: { allocation: false, settlement: false },
  carPlans: [],
  activeCarPlanId: 'plan-car',
  lastAutoAssignLabel: ''
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(`${source}\n;globalThis.__syncTest = { mergeConcurrentValue, buildConcurrentRoomMerge, hasLocalChangesSinceBase };`, context);
const { buildConcurrentRoomMerge } = context.__syncTest;

const base = {
  schemaVersion: 4,
  roomName: '企画',
  waiting: [],
  cars: [],
  activeCarPlanId: 'plan-car',
  carPlans: [{ id: 'plan-car', waiting: [{ name: 'A' }, { name: 'B' }], cars: [] }],
  settlement: {
    rounding: '100',
    cars: {
      A: { dist: '100', eco: '10', price: '160', extras: [] },
      B: { dist: '80', eco: '12', price: '160', extras: [] }
    },
    paid: { A: false, B: false }
  },
  overview: { memo: '' }
};

// Two people editing different cars must both survive.
const remoteCarA = structuredClone(base);
remoteCarA.settlement.cars.A.dist = '150';
remoteCarA.lastUpdatedBy = 'client-a';
remoteCarA.revision = 5;
const localCarB = structuredClone(base);
localCarB.settlement.cars.B.price = '170';
localCarB.lastUpdatedBy = 'client-b';
localCarB.lastUpdatedAt = 1000;
const mergedCars = buildConcurrentRoomMerge(remoteCarA, base, localCarB);
assert.equal(mergedCars.settlement.cars.A.dist, '150');
assert.equal(mergedCars.settlement.cars.B.price, '170');
assert.equal(mergedCars.revision, 6);

// Simultaneous payment checks must merge by participant key.
const remotePaid = structuredClone(base);
remotePaid.settlement.paid.A = true;
remotePaid.revision = 9;
const localPaid = structuredClone(base);
localPaid.settlement.paid.B = true;
localPaid.lastUpdatedAt = 1001;
const mergedPaid = buildConcurrentRoomMerge(remotePaid, base, localPaid);
assert.equal(mergedPaid.settlement.paid.A, true);
assert.equal(mergedPaid.settlement.paid.B, true);

// A stale settlement editor must NOT re-add a participant deleted remotely.
const remoteDelete = structuredClone(base);
remoteDelete.carPlans[0].waiting = [{ name: 'A' }];
remoteDelete.revision = 12;
const staleSettlementEdit = structuredClone(base);
staleSettlementEdit.settlement.cars.A.dist = '123';
staleSettlementEdit.lastUpdatedAt = 1002;
const mergedDelete = buildConcurrentRoomMerge(remoteDelete, base, staleSettlementEdit);
assert.equal(JSON.stringify(mergedDelete.carPlans[0].waiting.map(x => x.name)), JSON.stringify(['A']));
assert.equal(mergedDelete.settlement.cars.A.dist, '123');

// A local participant deletion must survive an unrelated remote settlement edit.
const localDelete = structuredClone(base);
localDelete.carPlans[0].waiting = [{ name: 'A' }];
localDelete.waiting = [{ name: 'A' }];
localDelete.lastUpdatedAt = 1003;
const remoteSettlement = structuredClone(base);
remoteSettlement.settlement.cars.B.eco = '14';
remoteSettlement.revision = 20;
const mergedLocalDelete = buildConcurrentRoomMerge(remoteSettlement, base, localDelete);
assert.equal(JSON.stringify(mergedLocalDelete.carPlans[0].waiting.map(x => x.name)), JSON.stringify(['A']));
assert.equal(mergedLocalDelete.settlement.cars.B.eco, '14');

// No noisy "someone else edited" popup and no bypass around the merge path.
assert.doesNotMatch(source, /他の人が(?:更新|編集)しました/);
assert.doesNotMatch(sheet, /update\(dbRef\s*,\s*payload\)/);
assert.match(sheet, /queueRemoteSnapshotSave\(snapshot,\s*80\)/);

console.log('PASS multi-user concurrent sync contract');
