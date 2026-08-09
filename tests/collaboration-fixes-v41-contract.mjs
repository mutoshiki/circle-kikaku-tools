import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const sync = read('assets/js/core/sync-controller.js');
const entitySource = read('assets/js/core/entity-state-v5.js');
const batch = read('assets/js/features/batch-import.js');
const dataState = read('assets/js/core/data-state.js');
const personMenu = read('assets/js/features/person-menu.js');
const settlementEvents = read('assets/js/features/events/04-settlement-input-events.js');
const settlementActions = read('assets/js/features/settlement/05-input-actions.js');
const settlementTemplate = read('assets/js/templates/settlement/03-car-cost-templates.js');
const waitingCss = read('assets/css/cars-members-tray/waiting-tray/06-action-and-list-layout.css');
const trayCss = read('assets/css/cars-members-tray/waiting-tray/05-tray-states.css');
const shareActions = read('assets/js/features/share-actions.js');
const drag = read('assets/js/features/drag-edit-view.js');
const index = read('index.html');

const entityContext = vm.createContext({ window: {}, console, Date, JSON, Math, Object, Array, Set, Map, String, Number, parseInt });
vm.runInContext(`${entitySource}\n;globalThis.__entity = window.SanpoCanonicalState;`, entityContext);
const entity = entityContext.__entity;

const context = {
  console, window: {}, document: {}, CFG: { STORE: 'test' }, roomId: 'ROOM', APP_SCHEMA_VERSION: 5, myClientId: 'local',
  L: { getItem: () => null, setItem() {}, removeItem() {} }, J: JSON,
  safeJsonParse: (value, fallback = null) => { try { return JSON.parse(value); } catch { return fallback; } },
  migrateAppData: value => entity.migrate(value), lastSyncedData: null, lastSyncedRevision: 0,
  pendingRemoteSettlementData: null, pendingRemoteRoomData: null, syncWriteInFlight: false, saveTimer: null,
  saveRequestVersion: 0, isRemoteUpdate: false, dbRef: null, lastUpdatedAt: 0, currentView: 'list',
  isSettlementInputProtected: () => false, isDraggingCards: false, manualCardDrag: null, queueMicrotask: fn => fn(),
  setTimeout, clearTimeout, $: () => ({ value: '', innerHTML: '' }), byId: () => ({ classList: { contains: () => false }, dataset: {} }),
  getData: () => ({}), restore() {}, updateStatus() {}, rememberTrustedDevice() {}, updateEditLockButton() {},
  refreshRoomTitle() {}, updateUI() {}, hideAppLoadingSkeleton() {}, onValue() {}, set: async () => {}, update: async () => {},
  requestPassphrasePanel: async () => '', getTrustedDeviceKey: () => 'trusted', showAppNotice() {}, location: { reload() {} },
  isProcessingQueue: false, editLockEnabled: false, editLockPassphrase: '', editLockScopes: {}, carPlans: [], activeCarPlanId: '', lastAutoAssignLabel: ''
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(`${sync}\n;globalThis.__v41 = { buildConcurrentRoomMerge };`, context);
const { buildConcurrentRoomMerge } = context.__v41;

const legacy = {
  schemaVersion: 4, roomName: '企画', activeCarPlanId: 'plan-car',
  carPlans: [
    { id: 'plan-car', templateType: 'car', name: '車割', waiting: [{ name: 'Alice' }, { name: 'Bob' }], cars: [{ name: 'Driver', capacity: 3, members: [] }] },
    { id: 'plan-team', templateType: 'team', name: '班割', waiting: [{ name: 'Alice' }, { name: 'Bob' }], cars: [{ name: 'Driver', capacity: 3, members: [] }] }
  ],
  settlement: { cars: { Driver: { dist: '10', eco: '10', price: '160', extras: [] } }, paid: { Alice: false, Bob: false } },
  overview: {}
};
const room = entity.migrate(legacy);
const aliceId = entity.findParticipantIdByName(room.participants, 'Alice');
const bobId = entity.findParticipantIdByName(room.participants, 'Bob');
const driverId = entity.findParticipantIdByName(room.participants, 'Driver');
const carGroup = Object.values(room.allocations.car.groups).find(g => g.ownerId === driverId);
const teamGroup = Object.values(room.allocations.team.groups).find(g => g.ownerId === driverId);

// Device A deletes Alice while device B moves Bob into Driver's group. Neither may undo the other.
const remoteMove = structuredClone(room);
remoteMove.allocations.car.placements[bobId] = { kind: 'member', groupId: carGroup.id, order: 1, updatedAt: 50 };
remoteMove.allocations.team.placements[bobId] = { kind: 'member', groupId: teamGroup.id, order: 1, updatedAt: 50 };
const localDelete = structuredClone(room);
delete localDelete.participants[aliceId];
localDelete.participantTombstones ||= {};
localDelete.participantTombstones[aliceId] = { deletedAt: 100 };
delete localDelete.allocations.car.placements[aliceId];
delete localDelete.allocations.team.placements[aliceId];
localDelete.lastUpdatedAt = 100;
const merged = buildConcurrentRoomMerge(remoteMove, room, localDelete);
assert.equal(merged.participants[aliceId], undefined, 'deleted participant must not resurrect');
assert.equal(merged.allocations.car.placements[bobId].kind, 'member', 'other-device car move survives deletion');
assert.equal(merged.allocations.team.placements[bobId].kind, 'member', 'other-device team move survives deletion');

// Inverse race: remote deletion survives a stale local Bob move.
const remoteDelete = structuredClone(room);
delete remoteDelete.participants[aliceId];
remoteDelete.participantTombstones ||= {};
remoteDelete.participantTombstones[aliceId] = { deletedAt: 200 };
delete remoteDelete.allocations.car.placements[aliceId];
delete remoteDelete.allocations.team.placements[aliceId];
const localMove = structuredClone(room);
localMove.allocations.car.placements[bobId] = { kind: 'member', groupId: carGroup.id, order: 1, updatedAt: 150 };
localMove.lastUpdatedAt = 150;
const mergedInverse = buildConcurrentRoomMerge(remoteDelete, room, localMove);
assert.equal(mergedInverse.participants[aliceId], undefined);
assert.equal(mergedInverse.allocations.car.placements[bobId].kind, 'member');

// Signed settlement types use Carbon Select's official event and preserve their labels.
assert.match(settlementEvents, /addEventListener\('cds-select-selected'/, 'Carbon select official event is handled');
assert.match(settlementEvents, /event\.detail\?\.value[\s\S]*commitSettlementExtraTypeSelection/, 'official selected value is committed before DOM snapshot');
assert.match(settlementActions, /'split-minus': '割勘 −'/);
assert.match(settlementActions, /'club-minus': '部費 −'/);
assert.match(settlementTemplate, /'split-minus': '割勘 −'/);
assert.match(settlementTemplate, /'club-minus': '部費 −'/);

// Roster deletion remains authoritative and incoming repaint is deferred during local edits.
assert.match(batch, /canonical\.participants = newParticipants/, 'participant registration replaces the canonical participant master');
assert.match(dataState, /function synchronizeParticipantRosterFromCurrentDom[\s\S]*pruneSettlementStateToRegisteredParticipants/, 'DOM roster sync prunes settlement against canonical participants');
assert.match(personMenu, /deletingFromWaiting[\s\S]*synchronizeParticipantRosterFromCurrentDom/, 'waiting-zone deletion commits through canonical roster sync');
assert.match(sync, /let pendingRemoteRoomData = null/);
assert.match(sync, /saveTimer \|\| syncWriteInFlight \|\| isSettlementInputProtected\(\) \|\| isDraggingCards \|\| manualCardDrag/);
assert.doesNotMatch(sync, /他の人が(?:更新|編集)しました/);

// Mobile tray, drag-transient state, and external-browser share contract remain intact.
assert.match(waitingCss, /@media \(max-width: 640px\)[\s\S]*#waiting-list \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
assert.match(trayCss, /drag-transient-minimized/);
assert.match(drag, /drag-transient-minimized/);
assert.match(shareActions, /url\.searchParams\.set\('openExternalBrowser', '1'\)/);
assert.match(index, /sync-controller\.js\?v=entity-schema-v42/);
assert.match(index, /04-settlement-input-events\.js\?v=collaboration-fixes-v41/);
assert.match(index, /06-action-and-list-layout\.css\?v=collaboration-fixes-v41/);

console.log('PASS collaboration fixes v41 contract (canonical schema)');
