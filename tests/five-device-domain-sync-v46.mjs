import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const entitySource = fs.readFileSync(new URL('../assets/js/core/entity-state-v5.js', import.meta.url), 'utf8');
const ectx = vm.createContext({
  window: { SanpoClock: { now: () => Date.now(), isServerAligned: () => true } },
  console, Date, JSON, Math, Object, Array, Set, Map, String, Number, parseInt, encodeURIComponent, decodeURIComponent
});
vm.runInContext(`${entitySource}\n;globalThis.E=window.SanpoCanonicalState`, ectx);
const E = ectx.E;
const syncSource = fs.readFileSync(new URL('../assets/js/core/sync-controller.js', import.meta.url), 'utf8');
const sctx = vm.createContext({
  window: { SanpoCanonicalState: E, SanpoClock: { now: () => Date.now(), isServerAligned: () => true } },
  console, Date, JSON, Math, Object, Array, Set, String, Number, parseInt, encodeURIComponent, decodeURIComponent,
  APP_SCHEMA_VERSION: 5, CFG: { STORE: 't' }, roomId: 'R', myClientId: 'test',
  migrateAppData: value => E.migrate(value || {}), safeJsonParse: JSON.parse,
  L: { getItem: () => null, setItem() {}, removeItem() {} }, J: JSON,
  isRemoteUpdate: false, dbRef: null, lastSyncedData: null, lastSyncedRevision: 0,
  pendingRemoteSettlementData: null, pendingRemoteRoomData: null, saveRequestVersion: 0, saveTimer: null, syncWriteInFlight: false,
  isSettlementInputProtected: () => false, isDraggingCards: false, manualCardDrag: null, manualSheetDrag: null,
  updateStatus() {}, restore() {}, getData: () => ({}), queueMicrotask: fn => fn(), requestAnimationFrame: fn => fn(),
  editLockEnabled: false, editLockPassphrase: '', editLockScopes: {}, carPlans: [], activeCarPlanId: '', lastAutoAssignLabel: '',
  rememberTrustedDevice() {}, updateEditLockButton() {}, refreshRoomTitle() {}, updateUI() {}, hideAppLoadingSkeleton() {},
  requestPassphrasePanel: async () => '', getTrustedDeviceKey: () => '', location: { reload() {} }, set: async () => {}, update: async () => {}, onValue() {}
});
vm.runInContext(`${syncSource}\n;globalThis.S=window.SanpoEntitySyncTest`, sctx);
const S = sctx.S;
const clone = structuredClone;

function room() {
  let r = E.emptyRoom();
  const ids = [];
  for (let i = 0; i < 12; i++) ids.push(E.ensureParticipant(r.participants, { name: `P${i + 1}`, grade: (i % 4) + 1 }));
  r = E.migrate(r);
  for (let g = 0; g < 3; g++) {
    const id = ids[g]; const gid = `g${g}`;
    r.allocations.car.groups[gid] = { id: gid, ownerId: id, capacity: 3, order: g, createdAt: 10, updatedAt: 10 };
    r.allocations.car.placements[id] = { kind: 'driver', groupId: gid, order: g, updatedAt: 10 };
  }
  E.ensureAllParticipantsPlaced(r.allocations.car, r.participants);
  E.ensureAllParticipantsPlaced(r.allocations.team, r.participants);
  r.lastUpdatedAt = 10; r.lastUpdatedBy = 'base';
  return { r: E.migrate(r), ids };
}

function commit(server, base, local, clientId, seq) {
  const next = clone(local);
  next.lastUpdatedBy = clientId;
  const patch = S.buildEntityPatch(base, next);
  return E.migrate(S.applyVersionedEntityPatch(server, base, next, patch, seq));
}

// Domain narrowness: a modal save must never resend unrelated room domains.
{
  const { r, ids } = room();
  const settlement = clone(r);
  settlement.settlement.carsByParticipantId = { [ids[0]]: { dist: '123', eco: '16', price: '171', extras: [{ name: '駐車場', amount: '500', type: 'club-minus' }] } };
  settlement.lastUpdatedAt = 100;
  const p = S.buildEntityPatch(r, settlement);
  assert.ok(Object.keys(p).some(path => path.startsWith('settlement/')));
  assert.equal(Object.keys(p).some(path => path.startsWith('participants/') || path.startsWith('allocations/')), false, 'settlement modal must not resend participants/allocation');

  const allocation = clone(r);
  allocation.allocations.car.placements[ids[5]] = { kind: 'member', groupId: 'g0', order: 1, updatedAt: 110 };
  allocation.allocations.car.updatedAt = 110;
  allocation.lastUpdatedAt = 110;
  const pa = S.buildEntityPatch(r, allocation);
  assert.ok(Object.keys(pa).some(path => path.startsWith('allocations/car/placements/')));
  assert.equal(Object.keys(pa).some(path => path.startsWith('settlement/')), false, 'card drag must not resend settlement');
}

// Five different surfaces commit from the same initial room. Every disjoint edit survives regardless of arrival order.
{
  const { r: base, ids } = room();
  const edits = [];
  const carCost = clone(base);
  carCost.settlement.carsByParticipantId[ids[0]] = { dist: '241.3', eco: '14', price: '172', extras: [{ name: '部費調整', amount: '800', type: 'club-minus' }] };
  carCost.lastUpdatedAt = 110; edits.push(['settlement-car', carCost]);

  const allocation = clone(base);
  allocation.allocations.car.placements[ids[6]] = { kind: 'member', groupId: 'g1', order: 1, updatedAt: 120 };
  allocation.allocations.car.updatedAt = 120; allocation.lastUpdatedAt = 120; edits.push(['allocation', allocation]);

  const participant = clone(base);
  participant.participants[ids[7]].grade = 4; participant.participants[ids[7]].updatedAt = 130;
  participant.lastUpdatedAt = 130; edits.push(['participant', participant]);

  const settings = clone(base);
  settings.settlement.rounding = '500'; settings.settlement.driverReward = '1000'; settings.settlement.driverRewardType = 'club';
  settings.lastUpdatedAt = 140; edits.push(['settlement-settings', settings]);

  const roomMeta = clone(base);
  roomMeta.roomName = '五端末テスト'; roomMeta.editLockScopes = { allocation: true, settlement: false }; roomMeta.lastUpdatedAt = 150;
  edits.push(['room-meta', roomMeta]);

  const orders = [edits, [...edits].reverse(), [edits[2], edits[4], edits[0], edits[3], edits[1]]];
  for (const order of orders) {
    let server = clone(base); let n = 0;
    for (const [client, local] of order) server = commit(server, base, local, client, ++n);
    assert.equal(server.settlement.carsByParticipantId[ids[0]].extras[0].type, 'club-minus');
    assert.equal(server.allocations.car.placements[ids[6]].kind, 'member');
    assert.equal(server.allocations.car.placements[ids[6]].groupId, 'g1');
    assert.equal(server.participants[ids[7]].grade, 4);
    assert.equal(server.settlement.rounding, '500');
    assert.equal(server.roomName, '五端末テスト');
    assert.deepEqual(server.editLockScopes, { allocation: true, settlement: false });
  }
}

// Remote allocation update arriving while a settlement modal is conceptually open must survive the stale-base settlement submit.
{
  const { r: base, ids } = room();
  const remoteMove = clone(base);
  remoteMove.allocations.car.placements[ids[8]] = { kind: 'member', groupId: 'g2', order: 0, updatedAt: 200 };
  remoteMove.allocations.car.updatedAt = 200; remoteMove.lastUpdatedAt = 200;
  let server = commit(base, base, remoteMove, 'device-B', 1);

  const staleModal = clone(base);
  staleModal.settlement.carsByParticipantId[ids[1]] = { dist: '99', eco: '12', price: '180', extras: [{ name: '高速', amount: '1200', type: 'split-minus' }] };
  staleModal.lastUpdatedAt = 210;
  server = commit(server, base, staleModal, 'device-A', 1);
  assert.equal(server.allocations.car.placements[ids[8]].groupId, 'g2');
  assert.equal(server.settlement.carsByParticipantId[ids[1]].extras[0].type, 'split-minus');
}

// Device presentation choices are explicitly local and cannot produce a room patch.
{
  const { r } = room();
  const local = clone(r); local.activeAllocationType = 'team'; local.trayMinimized = true; local.lastUpdatedAt = 999;
  const p = S.buildEntityPatch(r, local);
  assert.equal(Object.keys(p).some(path => path === 'activeAllocationType' || path === 'trayMinimized'), false);
}

// Participant deletion is authoritative even if a stale settlement edit arrives afterwards.
{
  const { r: base, ids } = room(); const victim = ids[9];
  const del = clone(base); del.participantTombstones[victim] = { deletedAt: 400 }; delete del.participants[victim];
  for (const type of ['car','team']) delete del.allocations[type].placements[victim]; del.lastUpdatedAt = 400;
  let server = commit(base, base, del, 'device-D', 1);
  const stale = clone(base); stale.settlement.paidByParticipantId[victim] = true; stale.lastUpdatedAt = 410;
  server = commit(server, base, stale, 'device-E', 1);
  assert.equal(server.participants[victim], undefined);
  assert.equal(server.settlement.paidByParticipantId?.[victim], undefined);
}

console.log('Five-device domain + modal sync v46: PASS');
