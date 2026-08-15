import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const entitySource = read('assets/js/core/entity-state-v5.js');
const syncSource = read('assets/js/core/sync-controller.js');
const diagnosticsSource = read('assets/js/core/sync-diagnostics.js');
const historySource = read('assets/js/features/sample-data-history.js');
const workflow = read('.github/workflows/quality-guard.yml');
const rules = JSON.parse(read('firebase/database.rules.json'));
const securityGuide = read('FIREBASE_SECURITY_ROLLOUT.md');
const index = read('index.html');

assert.match(syncSource, /function summarizeSyncOutcome/);
assert.match(syncSource, /SanpoSyncDiagnostics\?\.record/);
assert.match(syncSource, /同時編集を調整/);
assert.match(diagnosticsSource, /MAX_ENTRIES = 60/);
assert.match(diagnosticsSource, /syawari_sync_diagnostics_/);
assert.match(historySource, /appendSyncDiagnostics/);
assert.match(index, /sync-diagnostics\.js\?v=sync-reliability-v67/);
assert.match(index, /sync-controller\.js\?v=(?:sync-reliability-v67|sync-protocol-v68)/);
assert.match(workflow, /Five-device collaboration simulation/);
assert.match(workflow, /npm run test:collab:full/);
assert.equal(rules.rules.rooms.$roomId['.read'], 'auth != null && $roomId.matches(/^[A-Za-z0-9_-]{6,80}$/)');
assert.match(rules.rules.rooms.$roomId['.write'], /!newData\.exists\(\)/, 'room reset must remain permitted');
assert.match(rules.rules.rooms.$roomId['.validate'], /lastUpdatedBy.*isString/, 'canonical writer identity must be a string');
assert.match(rules.rules.rooms.$roomId['.validate'], /participants.*hasChildren/, 'participant maps must reject primitive values');
assert.match(rules.rules.rooms.$roomId.revision['.validate'], /newData\.val\(\) >= data\.val\(\)/, 'revision must never regress');
assert.match(rules.rules.rooms.$roomId.participants.$participantId['.validate'], /participantTombstones/, 'Rules must reject tombstone resurrection');
assert.match(securityGuide, /not deployed/i);
assert.match(securityGuide, /Anonymous authentication/i);

const context = vm.createContext({
  window: { SanpoClock: { now: () => 1000, isServerAligned: () => true } },
  console, Date, JSON, Math, Object, Array, Set, Map, String, Number, parseInt, encodeURIComponent, decodeURIComponent,
  APP_SCHEMA_VERSION: 6, CFG: { STORE: 'test' }, roomId: 'ROOM', myClientId: 'client',
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
const outcome = context.window.SanpoEntitySyncTest.summarizeSyncOutcome(
  { 'allocations/car/placements/p1': { kind: 'member', groupId: 'g1' }, revision: 2 },
  {},
  { allocations: { car: { placements: { p1: { kind: 'waiting', groupId: '' } } } } }
);
assert.equal(outcome.adjustedPaths.length, 1);
assert.deepEqual([...outcome.labels], ['車割・班割の配置']);

console.log('Sync reliability v67 contract: PASS');
