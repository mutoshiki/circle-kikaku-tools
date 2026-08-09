import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const sync = read('assets/js/core/sync-controller.js');
const batch = read('assets/js/features/batch-import.js');
const personMenu = read('assets/js/features/person-menu.js');
const settlementEvents = read('assets/js/features/events/04-settlement-input-events.js');
const settlementActions = read('assets/js/features/settlement/05-input-actions.js');
const settlementTemplate = read('assets/js/templates/settlement/03-car-cost-templates.js');
const waitingCss = read('assets/css/cars-members-tray/waiting-tray/06-action-and-list-layout.css');
const trayCss = read('assets/css/cars-members-tray/waiting-tray/05-tray-states.css');
const shareActions = read('assets/js/features/share-actions.js');
const drag = read('assets/js/features/drag-edit-view.js');
const index = read('index.html');

const context = {
  console,
  window: {},
  document: {},
  CFG: { STORE: 'test' },
  roomId: 'ROOM',
  APP_SCHEMA_VERSION: 4,
  myClientId: 'local',
  L: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  J: JSON,
  safeJsonParse: (value, fallback = null) => { try { return JSON.parse(value); } catch { return fallback; } },
  migrateAppData: x => x,
  lastSyncedData: null,
  lastSyncedRevision: 0,
  pendingRemoteSettlementData: null,
  pendingRemoteRoomData: null,
  syncWriteInFlight: false,
  saveTimer: null,
  saveRequestVersion: 0,
  isRemoteUpdate: false,
  dbRef: null,
  lastUpdatedAt: 0,
  currentView: 'list',
  isSettlementInputProtected: () => false,
  isDraggingCards: false,
  manualCardDrag: null,
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
vm.runInContext(`${sync}\n;globalThis.__v41 = { buildConcurrentRoomMerge, mergeConcurrentCarPlans };`, context);
const { buildConcurrentRoomMerge } = context.__v41;

const member = name => ({ name, memo: '', gender: 'unknown', grade: 0, locked: false, flag: 'none' });
const car = (name, members = []) => ({ name, capacity: '3', driverMemo: '', driverGender: 'unknown', driverGrade: 0, driverFlag: 'none', members });
const plan = (id, waiting, cars, templateType = 'car') => ({ id, name: templateType === 'team' ? '班割' : '車割', templateType, waiting, cars, createdAt: 1, updatedAt: 1, lastAutoAssignLabel: '' });
const room = {
  schemaVersion: 4,
  roomName: '企画',
  activeCarPlanId: 'plan-car',
  carPlans: [
    plan('plan-car', [member('Alice'), member('Bob')], [car('Driver')]),
    plan('plan-team', [member('Alice'), member('Bob')], [car('Driver')], 'team')
  ],
  waiting: [member('Alice'), member('Bob')],
  cars: [car('Driver')],
  settlement: { cars: { Driver: { dist: '10', eco: '10', price: '160', extras: [] } }, paid: { Alice: false, Bob: false } },
  overview: {}
};

// Device A deletes Alice while device B moves Bob into Driver's car. Neither action may undo the other.
const remoteMove = structuredClone(room);
for (const p of remoteMove.carPlans) {
  p.waiting = p.waiting.filter(x => x.name !== 'Bob');
  p.cars[0].members.push(member('Bob'));
}
remoteMove.waiting = [member('Alice')];
remoteMove.cars = [car('Driver', [member('Bob')])];
remoteMove.revision = 4;

const localDelete = structuredClone(room);
for (const p of localDelete.carPlans) p.waiting = p.waiting.filter(x => x.name !== 'Alice');
localDelete.waiting = [member('Bob')];
localDelete.lastUpdatedAt = 100;
const merged = buildConcurrentRoomMerge(remoteMove, room, localDelete);
for (const p of merged.carPlans) {
  const names = [
    ...(p.waiting || []).map(x => x.name),
    ...(p.cars || []).flatMap(c => [c.name, ...(c.members || []).map(x => x.name)])
  ];
  assert.equal(names.includes('Alice'), false, 'deleted participant must not resurrect in any plan');
  assert.equal(p.cars[0].members.some(x => x.name === 'Bob'), true, 'other device move survives participant deletion');
}
assert.equal(merged.waiting.some(x => x.name === 'Alice'), false, 'compat waiting mirror follows merged active plan');
assert.equal(merged.cars[0].members.some(x => x.name === 'Bob'), true, 'compat cars mirror follows merged active plan');

// Inverse race: remote deletion must survive a stale local move.
const remoteDelete = structuredClone(room);
for (const p of remoteDelete.carPlans) p.waiting = p.waiting.filter(x => x.name !== 'Alice');
remoteDelete.revision = 8;
const localMove = structuredClone(room);
for (const p of localMove.carPlans) {
  p.waiting = p.waiting.filter(x => x.name !== 'Bob');
  p.cars[0].members.push(member('Bob'));
}
localMove.lastUpdatedAt = 200;
const mergedInverse = buildConcurrentRoomMerge(remoteDelete, room, localMove);
assert.equal(mergedInverse.carPlans.some(p => p.waiting.some(x => x.name === 'Alice') || p.cars.some(c => c.members.some(x => x.name === 'Alice'))), false);
assert.equal(mergedInverse.carPlans.every(p => p.cars[0].members.some(x => x.name === 'Bob')), true);

// Signed settlement types must use Carbon Select's official event and survive every UI label path.
assert.match(settlementEvents, /addEventListener\('cds-select-selected'/, 'Carbon select official event is handled');
assert.match(settlementEvents, /event\.detail\?\.value[\s\S]*commitSettlementExtraTypeSelection/, 'official selected value is committed before DOM snapshot');
assert.match(settlementActions, /'split-minus': '割勘 −'/, 'delete confirmation keeps split-minus semantics');
assert.match(settlementActions, /'club-minus': '部費 −'/, 'delete confirmation keeps club-minus semantics');
assert.match(settlementTemplate, /'split-minus': '割勘 −'/, 'candidate UI keeps split-minus label');
assert.match(settlementTemplate, /'club-minus': '部費 −'/, 'candidate UI keeps club-minus label');

// Roster deletion is explicitly committed across both plans and stale settlement keys are pruned.
assert.match(batch, /synchronizeParticipantRosterFromCurrentDom/, 'participant registration explicitly commits authoritative roster');
assert.match(personMenu, /deletingFromWaiting[\s\S]*synchronizeParticipantRosterFromCurrentDom/, 'waiting-zone deletion is authoritative across plans');
assert.match(sync, /let pendingRemoteRoomData = null/, 'generic pending remote state exists');
assert.match(sync, /saveTimer \|\| syncWriteInFlight \|\| isSettlementInputProtected\(\) \|\| isDraggingCards \|\| manualCardDrag/, 'remote repaint is deferred during local edits and drag');
assert.doesNotMatch(sync, /他の人が(?:更新|編集)しました/, 'no noisy collaboration popup remains');

// Mobile participant tray must be exactly two columns, independent of iPhone visual viewport quirks.
assert.match(waitingCss, /@media \(max-width: 640px\)[\s\S]*#waiting-list \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/, 'mobile waiting list is fixed to two columns');
assert.match(trayCss, /drag-transient-minimized/, 'transient drag-collapse style exists');
assert.match(drag, /drag-transient-minimized/, 'drop targeting understands transient collapse');

// LINE's documented external-browser query parameter is included in every purpose share URL.
assert.match(shareActions, /url\.searchParams\.set\('openExternalBrowser', '1'\)/, 'share links request LINE external/default browser');
assert.match(index, /sync-controller\.js\?v=collaboration-fixes-v41/, 'sync fix is cache-busted for iPhone clients');
assert.match(index, /04-settlement-input-events\.js\?v=collaboration-fixes-v41/, 'settlement type fix is cache-busted');
assert.match(index, /06-action-and-list-layout\.css\?v=collaboration-fixes-v41/, 'mobile grid fix is cache-busted');

console.log('PASS collaboration fixes v41 contract');
