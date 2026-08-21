import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const entitySource = read('assets/js/core/entity-state-v5.js');
const syncSource = read('assets/js/core/sync-controller.js');
const diagnosticsSource = read('assets/js/core/sync-diagnostics.js');
const uiSource = read('assets/js/modules/ui.js');
const roomStatusCss = read('assets/css/app-shell/header/02-room-status.css');
const notificationCss = read('assets/css/guides-modals/notices/01-copy-lock.css');
const historySource = read('assets/js/features/sample-data-history.js');
const workflow = read('.github/workflows/quality-guard.yml');
const rules = JSON.parse(read('firebase/database.rules.json'));
const securityGuide = read('FIREBASE_SECURITY_ROLLOUT.md');
const index = read('index.html');

assert.match(syncSource, /function summarizeSyncOutcome/);
assert.match(syncSource, /SanpoSyncDiagnostics\?\.record/);
assert.match(syncSource, /同時編集を調整/);
assert.doesNotMatch(syncSource, /showAppNotice\?\.\(`\$\{message\}。この端末の履歴で確認できます。`\)/, 'normal merge adjustments must stay in diagnostics without a popup');
assert.match(uiSource, /const changed = previousKind !== kind \|\| state\.syncMessage !== nextMessage/, 'repeated sync snapshots retain their equality signal');
assert.match(uiSource, /if \(!changed && !\(kind === 'connected' && state\.syncSavePending\)\) return;/, 'a pending real save may complete even if unrelated status chatter made the connected snapshot text repeat');
assert.match(uiSource, /syncSavePending:\s*false/, 'real save completion has an explicit notification-cycle owner');
assert.match(uiSource, /const SYNC_PROGRESS_DELAY = 650;/, 'save progress is delayed so fast saves skip the noisy in-progress toast');
assert.match(uiSource, /kind === 'saving'[\s\S]*setTimeout[\s\S]*showSyncToast\('saving'[\s\S]*persistent: true/, 'long-running saves use a persistent Carbon progress toast');
assert.match(uiSource, /kind === 'error'[\s\S]*showSyncToast\(kind, nextMessage, \{ persistent: copy\.tone === 'error' \}\)/, 'actionable sync errors remain visible while transport-readiness warnings may resolve automatically');
assert.match(uiSource, /kind === 'connected'[\s\S]*recoveredFromProblem[\s\S]*completedSave[\s\S]*explicitReplay[\s\S]*if \(explicitReplay \|\| recoveredFromProblem\)[\s\S]*else if \(completedSave\)/, 'a real save completion remains visible even when progress was too fast to show, while explicitly suppressed UI-only interactions stay quiet');
assert.match(uiSource, /syncSuppressedSaveCycle[\s\S]*syncSuppressUntil = 0/, 'quiet-interaction suppression is consumed by its own incidental save cycle');
assert.match(uiSource, /document\.createElement\('cds-toast-notification'\)/, 'save and sync feedback uses the Carbon toast component');
assert.match(uiSource, /id = slot === 'sync' \? 'appSyncStatusToast' : 'appStatusToast'/, 'sync and general feedback share one Carbon notification owner while retaining distinct slots');
assert.match(uiSource, /aria-live'[\s\S]*assertive[\s\S]*polite/, 'notification urgency is reflected in accessible live-region behavior');
assert.doesNotMatch(roomStatusCss, /\.sync-status-badge/, 'the retired header status badge has no remaining CSS owner');
assert.match(notificationCss, /\.app-notification-region\s*\{[\s\S]*position:\s*fixed;[\s\S]*top:[^;]+;[\s\S]*right:/, 'Carbon notifications are stacked in a stable upper-right region');
assert.match(notificationCss, /\.app-notification-region[\s\S]*width:\s*min\(22rem, calc\(100vw - 2rem\)\)[\s\S]*\.app-status-toast[\s\S]*width:\s*100%/, 'notification region owns toast width instead of the project-title slot');
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
