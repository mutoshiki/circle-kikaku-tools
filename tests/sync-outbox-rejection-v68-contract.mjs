import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const entityContext = vm.createContext({ window: { SanpoClock: { now: () => 10 } }, console, Date, JSON, Math, Object, Array, Set, Map, String, Number, encodeURIComponent, decodeURIComponent });
vm.runInContext(`${source('assets/js/core/entity-state-v5.js')}\n;globalThis.E = window.SanpoCanonicalState`, entityContext);
const E = entityContext.E;
const store = new Map();
const statuses = [];
const notices = [];
const context = vm.createContext({
    window: { SanpoCanonicalState: E, SanpoClock: { now: () => 10, isServerAligned: () => true }, showAppNotice: (...args) => notices.push(args) },
    console: { error() {}, warn() {}, log() {} }, Date, JSON, Math, Object, Array, Set, Map, String, Number, encodeURIComponent, decodeURIComponent,
    APP_SCHEMA_VERSION: 6, CFG: { STORE: 'test' }, roomId: 'ROOM', myClientId: 'rejecting-client',
    migrateAppData: value => E.migrate(value || {}), safeJsonParse: JSON.parse,
    L: { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) }, J: JSON,
    isRemoteUpdate: false, dbRef: {}, lastSyncedData: null, lastSyncedRevision: 0, pendingRemoteSettlementData: null, pendingRemoteRoomData: null,
    saveRequestVersion: 0, saveTimer: null, syncWriteInFlight: false, isSettlementInputProtected: () => false, isDraggingCards: false,
    manualCardDrag: null, manualSheetDrag: null, isProcessingQueue: false, updateStatus: (...args) => statuses.push(args), restore() {}, getData: () => ({}),
    queueMicrotask: fn => fn(), requestAnimationFrame: fn => fn(), setTimeout: fn => { fn(); return 1; }, clearTimeout() {}, editLockEnabled: false, editLockPassphrase: '', editLockScopes: {},
    carPlans: [], activeCarPlanId: '', lastAutoAssignLabel: '', rememberTrustedDevice() {}, updateEditLockButton() {}, refreshRoomTitle() {}, updateUI() {}, hideAppLoadingSkeleton() {},
    requestPassphrasePanel: async () => '', getTrustedDeviceKey: () => '', location: { reload() {} }, set: async () => {}, update: async () => {}, onValue() {},
    runTransaction: async () => { const error = new Error('PERMISSION_DENIED: Permission denied'); error.code = 'PERMISSION_DENIED'; throw error; }
});
vm.runInContext(source('assets/js/core/sync-controller.js'), context);

const base = E.emptyRoom();
const local = E.migrate({ ...base, roomName: 'rejected write', lastUpdatedAt: 10, lastUpdatedBy: 'rejecting-client' });
const patch = context.window.SanpoEntitySyncTest.buildEntityPatch(base, local);
const committed = await context.window.SanpoSync.saveImmediate({ snapshot: local, baseSnapshot: base, patchOverride: patch });

assert.equal(committed, null, 'Rules rejection must not report success');
assert.equal([...store.keys()].some(key => key.includes('_sync_outbox_')), false, 'permanently rejected outbox must be removed');
assert.equal(notices.length, 0, 'background sync rejection must not interrupt the user with a toast');
assert.ok(statuses.some(([, label]) => String(label).includes('再送停止')), 'status must expose retry stop');

console.log('Sync outbox rejection v68 contract: PASS');
