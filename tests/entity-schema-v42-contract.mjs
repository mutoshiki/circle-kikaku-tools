import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const entitySource = fs.readFileSync(new URL('../assets/js/core/entity-state-v5.js', import.meta.url), 'utf8');
const entityContext = vm.createContext({ window: {}, console, Date, JSON, Math, Object, Array, Set, Map, String, Number, parseInt });
vm.runInContext(`${entitySource}\n;globalThis.__entity = window.SanpoCanonicalState;`, entityContext);
const entity = entityContext.__entity;

const legacy = {
  schemaVersion: 4,
  roomName: '企画',
  activeCarPlanId: 'plan-car',
  carPlans: [
    { id: 'plan-car', templateType: 'car', name: '車割', waiting: [{ name: 'Alice', grade: 2 }], cars: [{ name: 'Bob', capacity: 3, members: [{ name: 'Carol', grade: 3 }] }] },
    { id: 'plan-team', templateType: 'team', name: '班割', waiting: [{ name: 'Alice', grade: 2 }, { name: 'Bob' }, { name: 'Carol', grade: 3 }], cars: [] }
  ],
  settlement: { cars: { Bob: { dist: '100' } }, paid: { Alice: true }, driverPaid: { Bob: false } }
};
const migrated = entity.migrate(legacy);
assert.equal(migrated.schemaVersion, 5);
assert.equal(Object.keys(migrated.participants).length, 3, 'participants must exist once globally');
assert.ok(migrated.allocations.car && migrated.allocations.team);
assert.equal('carPlans' in migrated, false, 'canonical migration must not persist legacy plan arrays');
assert.equal('waiting' in migrated, false, 'canonical migration must not persist legacy waiting mirror');
assert.equal('cars' in migrated, false, 'canonical migration must not persist legacy cars mirror');
assert.equal(Object.keys(migrated.settlement.carsByParticipantId).length, 1, 'settlement cars use stable participant ids');

entity.set(migrated);
const carProjection = entity.projectAllocation(entity.get(), 'car');
const alice = carProjection.waiting.find(p => p.name === 'Alice');
assert.ok(alice?.participantId, 'UI projection carries stable participant id');

// Deleting Alice from the complete active roster is globally authoritative.
const domWithoutAlice = {
  waiting: [],
  cars: carProjection.cars.map(car => ({ ...car, members: car.members.filter(member => member.name !== 'Alice') }))
};
entity.captureFromDom(entity.get(), domWithoutAlice, 'car');
const afterDelete = entity.get();
assert.equal(Object.values(afterDelete.participants).some(p => p.name === 'Alice'), false, 'deleted participant cannot remain in participant master');
assert.equal(entity.projectAllocation(afterDelete, 'team').waiting.some(p => p.name === 'Alice'), false, 'deleted participant cannot resurrect from another allocation');
assert.equal(Object.keys(afterDelete.settlement.paidByParticipantId || {}).some(id => !afterDelete.participants[id]), false, 'settlement references are pruned with participant deletion');

// Rename keeps identity and therefore keeps settlement ownership stable.
const bobId = entity.findParticipantIdByName(afterDelete.participants, 'Bob');
const beforeBobCost = afterDelete.settlement.carsByParticipantId[bobId];
const projectionForRename = entity.projectAllocation(afterDelete, 'car');
const renamedDom = {
  waiting: projectionForRename.waiting.map(p => ({ ...p })),
  cars: projectionForRename.cars.map(car => car.participantId === bobId ? { ...car, name: 'Bobby' } : car)
};
entity.captureFromDom(afterDelete, renamedDom, 'car');
assert.equal(entity.get().participants[bobId].name, 'Bobby');
assert.deepEqual(entity.get().settlement.carsByParticipantId[bobId], beforeBobCost, 'rename must not re-key settlement by display name');

// New participant added to one allocation is automatically represented in the other as waiting.
const current = entity.projectAllocation(entity.get(), 'car');
const withDave = { ...current, waiting: [...current.waiting, { name: 'Dave', grade: 1 }] };
entity.captureFromDom(entity.get(), withDave, 'car');
const daveId = entity.findParticipantIdByName(entity.get().participants, 'Dave');
assert.ok(daveId);
const team = entity.projectAllocation(entity.get(), 'team');
assert.ok(team.waiting.some(p => p.participantId === daveId), 'new participant must be available in the other allocation without duplication');

// Entity patch concurrency: deleting Alice and moving Bob are disjoint participant paths.
const syncSource = fs.readFileSync(new URL('../assets/js/core/sync-controller.js', import.meta.url), 'utf8');
const syncContext = vm.createContext({
  window: {}, console, JSON, Object, Array, Set, String, Number, Date, Math,
  APP_SCHEMA_VERSION: 5,
  CFG: { STORE: 'test' }, roomId: 'ROOM', myClientId: 'client',
  migrateAppData: value => value,
  safeJsonParse: JSON.parse,
  L: { getItem: () => null, setItem() {}, removeItem() {} }, J: JSON,
  isRemoteUpdate: false, dbRef: null, lastSyncedData: null, lastSyncedRevision: 0,
  pendingRemoteSettlementData: null, saveRequestVersion: 0, saveTimer: null, syncWriteInFlight: false,
  isSettlementInputProtected: () => false, isDraggingCards: false, manualCardDrag: null,
  updateStatus() {}, restore() {}, getData: () => ({}), queueMicrotask: fn => fn(),
  editLockEnabled: false, editLockPassphrase: '', editLockScopes: {}, carPlans: [], activeCarPlanId: '', lastAutoAssignLabel: '',
  rememberTrustedDevice() {}, updateEditLockButton() {}, refreshRoomTitle() {}, updateUI() {}, hideAppLoadingSkeleton() {},
  requestPassphrasePanel: async () => '', getTrustedDeviceKey: () => '', location: { reload() {} }, set: async () => {}, update: async () => {}, onValue() {}
});
vm.runInContext(`${syncSource}\n;globalThis.__sync = { buildEntityPatch, applyEntityPatchToObject, patchHasDomainChanges };`, syncContext);
const { buildEntityPatch, applyEntityPatchToObject } = syncContext.__sync;
const base = entity.migrate(legacy);
const remote = structuredClone(base);
const local = structuredClone(base);
const aliceId2 = entity.findParticipantIdByName(base.participants, 'Alice');
const bobId2 = entity.findParticipantIdByName(base.participants, 'Bob');
delete local.participants[aliceId2];
delete local.allocations.car.placements[aliceId2];
delete local.allocations.team.placements[aliceId2];
remote.allocations.car.placements[bobId2] = { kind: 'waiting', groupId: '', order: 0, updatedAt: 999 };
const localPatch = buildEntityPatch(base, local);
assert.equal(localPatch[`participants/${aliceId2}`], null, 'participant deletion is an explicit Firebase path delete');
assert.equal(Object.keys(localPatch).some(path => path.includes(`placements/${bobId2}`)), false, 'unmodified Bob is not resent by Alice deletion');
const merged = applyEntityPatchToObject(remote, localPatch);
assert.equal(merged.participants[aliceId2], undefined, 'Alice remains deleted');
assert.equal(merged.allocations.car.placements[bobId2].kind, 'waiting', 'concurrent Bob move survives');

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(index, /entity-state-v5\.js\?v=entity-schema-v42/);
assert.doesNotMatch(index, /core\/runtime\.js\?v=multi-user-sync-v40/);

console.log('Entity schema v42 canonical state + entity sync contract: PASS');

// Regression: concurrent group creation vs stale cleanup placement must not split the owner entity.
{
  const baseRoom = entity.migrate(legacy);
  const bob = entity.findParticipantIdByName(baseRoom.participants, 'Bob');
  const car = baseRoom.allocations.car;
  // Simulate another device creating a new group for Bob.
  const remote = structuredClone(baseRoom);
  const gid = `g_car_${bob}_regression`;
  remote.allocations.car.groups[gid] = { id: gid, ownerId: bob, capacity: 3, order: 9, createdAt: 100, updatedAt: 200 };
  remote.allocations.car.placements[bob] = { kind: 'driver', groupId: gid, order: 9, updatedAt: 200 };
  // A stale device concurrently cleans Bob back to waiting after deleting an old group.
  const stale = structuredClone(baseRoom);
  stale.allocations.car.placements[bob] = { kind: 'waiting', groupId: '', order: 999, updatedAt: 150 };
  const mergedRaw = applyEntityPatchToObject(remote, buildEntityPatch(baseRoom, stale));
  const mergedCanonical = entity.migrate(mergedRaw);
  assert.equal(mergedCanonical.allocations.car.placements[bob].kind, 'driver', 'existing group owner must remain a driver after concurrent stale cleanup');
  assert.equal(mergedCanonical.allocations.car.placements[bob].groupId, gid, 'existing group and owner placement must stay coherent');
}

// Regression: settlement write arriving after participant deletion is pruned canonically.
{
  const baseRoom = entity.migrate(legacy);
  const aliceId = entity.findParticipantIdByName(baseRoom.participants, 'Alice');
  const deleted = structuredClone(baseRoom);
  delete deleted.participants[aliceId];
  deleted.participantTombstones[aliceId] = { deletedAt: 300 };
  delete deleted.allocations.car.placements[aliceId];
  delete deleted.allocations.team.placements[aliceId];
  const staleSettlement = structuredClone(baseRoom);
  staleSettlement.settlement.driverPaidByParticipantId ||= {};
  staleSettlement.settlement.driverPaidByParticipantId[aliceId] = true;
  const serverAfterDelete = applyEntityPatchToObject(baseRoom, buildEntityPatch(baseRoom, deleted));
  const serverAfterStaleSettlement = applyEntityPatchToObject(serverAfterDelete, buildEntityPatch(baseRoom, staleSettlement));
  const canonical = entity.migrate(serverAfterStaleSettlement);
  assert.equal(canonical.participants[aliceId], undefined, 'stale settlement write must not resurrect deleted participant');
  assert.equal(canonical.settlement.driverPaidByParticipantId[aliceId], undefined, 'stale settlement write for deleted participant must be pruned');
}
