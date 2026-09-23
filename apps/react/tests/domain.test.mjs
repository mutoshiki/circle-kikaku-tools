import test from 'node:test';
import assert from 'node:assert/strict';
import { createDomain, formParser } from '../src/domain/index.js';
import { createReference, fixture, plain, semanticRoom } from './reference.mjs';

// Fix wall-clock migration annotations as well as the injected action clock.
test.mock.timers.enable({ apis: ['Date'], now: 1000 });

function pair(now = 1000, clientId = 'fixture-client') {
  return {
    next: createDomain({ clock: { now: () => now, isServerAligned: () => true }, clientId, random: () => 0.25, crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000001' } }),
    old: createReference({ now, clientId }),
  };
}
function same(actual, expected) { assert.deepEqual(plain(actual), plain(expected)); }

test('canonical migration, roles, room metadata and projections match the untouched implementation', () => {
  const { next, old } = pair();
  for (const input of [fixture, { schemaVersion: 4 }, next.migrate(fixture)]) {
    const a = next.migrate(input);
    const b = old.migrateAppData(input);
    same(a, b);
    for (const type of ['car', 'team']) same(next.canonical.projectAllocation(a, type), old.SanpoCanonicalState.projectAllocation(b, type));
    same(next.canonical.settlementToUi(a.settlement, a.participants), old.SanpoCanonicalState.settlementToUi(b.settlement, b.participants));
    same(next.migrate(old.migrateAppData(a)), a);
    same(old.migrateAppData(next.migrate(b)), b);
  }
});

test('owner is structural, multiple driver roles and fixed participants survive independent allocations', async () => {
  const { next, old } = pair();
  const input = next.migrate(fixture);
  const car = input.allocations.car;
  const group = Object.values(car.groups)[0];
  car.placements[group.ownerId].driver = false;
  const members = Object.entries(car.placements).filter(([id, p]) => p.groupId === group.id && id !== group.ownerId);
  members.forEach(([, p]) => { p.driver = true; });
  const a = next.canonical.set(input);
  const b = old.SanpoCanonicalState.set(input);
  const untouchedTeam = structuredClone(a.allocations.team);
  same(a, b);
  const projected = next.canonical.projectAllocation(a, 'car');
  assert.equal(projected.cars[0].driver, false);
  assert.equal(projected.cars[0].members.filter(p => p.driver).length, 2);
  next.assignment.assign(a, 'car', next.canonical);
  old.SanpoSync = { saveImmediate() {} }; // Compare the command before its transport side effects.
  await old.autoAssign();
  same(a, old.SanpoCanonicalState.get());
  same(a.allocations.team, untouchedTeam);
  assert.equal(a.participants[members[0][0]].locked, true);
});

test('delete tombstones prevent revival from a stale plan in both allocations', () => {
  const { next, old } = pair();
  const a = next.canonical.set(fixture);
  const b = old.SanpoCanonicalState.set(fixture);
  const stale = next.canonical.projectPlans(a);
  const id = stale[0].cars[0].members[0].participantId;
  next.canonical.deleteParticipant(id, 1000);
  old.SanpoCanonicalState.deleteParticipant(id, 1000);
  for (const [index, type] of ['car', 'team'].entries()) {
    next.canonical.applyProjectedPlan(a, stale[index], type);
    old.SanpoCanonicalState.applyProjectedPlan(b, stale[index], type);
    assert.equal(a.allocations[type].placements[id], undefined);
  }
  same(a, b);
  assert.equal(a.participants[id], undefined);
  assert.ok(a.participantTombstones[id]);
});

test('settlement matrix preserves signed expenses, club/split, exemptions, offsets, rewards and standalone', () => {
  const { next, old } = pair();
  const room = next.migrate(fixture);
  const { data, state: initial } = next.settlementInput(room);
  let cases = 0;
  for (const rounding of ['1', '10', '100', '500'])
    for (const organizerFree of [false, true])
      for (const driverCollectionOffset of [false, true])
        for (const driverCollectionFree of [false, true])
          for (const driverRewardType of ['split', 'club'])
            for (const standalone of [false, true]) {
              const state = next.settlement.normalizeSettlementState({ ...initial, rounding, organizerFree, driverCollectionOffset, driverCollectionFree, driverRewardType, standalone: { enabled: standalone, driverCount: '2', memberCount: '4', driverNames: ['仮参加者A', '仮参加者D'] } });
              const input = standalone ? next.settlement.createStandaloneSettlementData(state, room.roomName) : data;
              const a = next.settlement.calculateSettlement(input, state);
              const b = old.calculateSettlement(input, state);
              same(a, b);
              same(next.settlement.getSettlementIssues(input, state, a), old.getSettlementIssues(input, state, b));
              same(next.canonical.settlementToStorage(state, room.participants), old.SanpoCanonicalState.settlementToStorage(state, room.participants));
              cases++;
            }
  assert.equal(cases, 128);
});

test('form parser preserves Japanese headers, quoted cells, grade inference and ambiguous/duplicate names', () => {
  const { old } = pair();
  for (const input of ['氏名\t学年\t車出し\n仮参加者A\t3\t可\n仮参加者B\t1\tいいえ', '名前,学籍番号,車\n"仮参加者,A",251234,はい\n仮参加者A,261234,不可', '名前\t学年\n仮参加者A\t２\n仮参加者A\t2', '', '名前\n仮参加者A']) {
    same(formParser.parseSpreadsheetImport(input, { now: new Date('2026-09-05T00:00:00Z') }), old.SanpoFormImportParser.parseSpreadsheetImport(input, { now: new Date('2026-09-05T00:00:00Z') }));
  }
});

test('patch, versioned transactions, extras merge, reset and operation replay match', () => {
  const { next, old } = pair();
  const base = next.migrate(fixture);
  const id = Object.keys(base.participants)[0];
  const local = structuredClone(base);
  local.participants[id].memo = '入力中のメモ';
  local.lastUpdatedAt = 1000;
  local.lastUpdatedBy = 'fixture-client';
  local.settlement.carsByParticipantId[id].extras.push({ id: 'new-local', name: '追加', amount: '123', type: 'club-minus' });
  const remote = structuredClone(base);
  remote.settlement.carsByParticipantId[id].extras.push({ id: 'new-remote', name: '別端末', amount: '456', type: 'split' });
  for (const forceCanonical of [false, true]) same(next.sync.buildEntityPatch(base, local, { forceCanonical }), old.SanpoEntitySyncTest.buildEntityPatch(base, local, { forceCanonical }));
  const patch = next.sync.buildEntityPatch(base, local);
  let a = next.sync.applyVersionedEntityPatch(remote, base, local, patch, 2, 'op_fixture_2', 1000);
  let b = old.SanpoEntitySyncTest.applyVersionedEntityPatch(remote, base, local, patch, 2, 'op_fixture_2', 1000);
  same(a, b);
  same(next.sync.applyVersionedEntityPatch(a, base, local, patch, 2, 'op_fixture_2', 1000), a);
  a.resetGeneration = 9;
  b.resetGeneration = 9;
  same(next.sync.applyVersionedEntityPatch(a, base, local, patch, 3, 'op_fixture_3', 1000), old.SanpoEntitySyncTest.applyVersionedEntityPatch(b, base, local, patch, 3, 'op_fixture_3', 1000));
  assert.equal(next.sync.applyVersionedEntityPatch(a, base, local, patch, 3).resetGeneration, 9);
  same(next.sync.buildSettlementSettingsIntentPatch(base, local), old.SanpoEntitySyncTest.buildSettlementSettingsIntentPatch(base, local));
  same(next.sync.buildSettlementCarIntentPatch(base, local, { participantId: id }), old.SanpoEntitySyncTest.buildSettlementCarIntentPatch(base, local, { participantId: id }));
  same(semanticRoom(old.migrateAppData(a)), semanticRoom(next.migrate(a)));
});

test('compatibility hazards are explicit: canonical cleanup, application metadata and outbox age', () => {
  const { next, old } = pair();
  const base = next.migrate(fixture);
  const patch = next.sync.buildEntityPatch({}, base, { forceCanonical: true });
  assert.equal(patch.activeAllocationType, null, 'legacy cleanup still conflicts with checked-in Rules');
  assert.ok(base.meta.applicationSync);
  assert.ok(!Object.keys(patch).some(path => path === 'meta' || path.startsWith('meta/')), 'application metadata has a separate write owner');
  for (const age of [0, 1000, 86400000, 86400001]) {
    same(next.sync.isExpiredSyncOutbox({ createdAt: 1000 }, 1000 + age), old.SanpoEntitySyncTest.isExpiredSyncOutbox({ createdAt: 1000 }, 1000 + age));
  }
});
