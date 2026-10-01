import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomStore } from '../src/store/room-store.js';
import { allocationView, storedAllocationCapacity, randomAllocationReview, allocationPresentation } from '../src/ui/allocation-view.js';

function allocationFixture() {
  const store = createRoomStore({ clock: { now: () => 1000 }, random: () => 0.4 });
  store.command('addParticipants', { people: ['A', 'B', 'C', 'D', 'E'].map(name => ({ name, driver: ['A', 'B'].includes(name) })) });
  const ids = Object.fromEntries(Object.values(store.getSnapshot().participants).map(p => [p.name, p.id]));
  const groups = { a: store.getSnapshot().allocations.car.placements[ids.A].groupId, b: store.getSnapshot().allocations.car.placements[ids.B].groupId };
  store.command('move', { id: ids.C, type: 'car', groupId: groups.a, order: 0 });
  store.command('move', { id: ids.D, type: 'car', groupId: groups.a, order: 1 });
  store.command('role', { id: ids.A, type: 'car', driver: false });
  store.command('role', { id: ids.C, type: 'car', driver: true });
  store.command('editParticipant', { id: ids.D, changes: { locked: true, memo: 'private note', flag: 'red', grade: 4 } });
  store.command('editParticipant', { id: ids.E, changes: { locked: true } });
  return { store, ids, groups };
}

test('allocation counts include the structural anchor but roles remain explicit', () => {
  const { store, ids, groups } = allocationFixture();
  const before = JSON.stringify(store.getSnapshot());
  const view = allocationView(store.getSnapshot(), 'car', store.domain.canonical);
  const group = view.groups.find(g => g.id === groups.a);
  assert.equal(group.peopleCount, 3);
  assert.equal(group.totalLimit, 4);
  assert.equal(group.vacancies, 1);
  assert.deepEqual(group.roles.map(p => p.participantId), [ids.C]);
  assert.deepEqual(group.people.map(p => p.participantId), [ids.A, ids.C, ids.D]);
  assert.equal(view.assignedCount, 4);
  assert.equal(view.waiting.length, 1);
  assert.equal(JSON.stringify(store.getSnapshot()), before);
});

test('capacity adapter validates rather than silently clamping and displays compatible larger values', () => {
  assert.equal(storedAllocationCapacity(2), 1);
  assert.equal(storedAllocationCapacity('100'), 99);
  for (const value of [1, 101, 3.5, '', null, undefined, '3people']) assert.throws(() => storedAllocationCapacity(value), /2.*100/);
  const { store, groups } = allocationFixture();
  store.command('capacity', { type: 'car', groupId: groups.a, capacity: 120 });
  assert.equal(allocationView(store.getSnapshot(), 'car', store.domain.canonical).groups.find(g => g.id === groups.a).totalLimit, 121);
});

test('random review uses actual eligibility including role-free anchor and fixed waiting people', () => {
  const { store, ids, groups } = allocationFixture();
  const review = () => randomAllocationReview(store.getSnapshot(), 'car', store.domain.assignment);
  const initial = review();
  assert.deepEqual([initial.eligibleCount, initial.fixedCount, initial.roleCount, initial.fixedWaitingCount, initial.slotCount], [1, 2, 2, 1, 4]);
  store.command('editParticipant', { id: ids.C, changes: { memo: 'unrelated memo' } });
  assert.equal(review().scope, initial.scope);
  const costRoom = structuredClone(store.getSnapshot()); costRoom.settlement.memo = 'unrelated expense';
  assert.equal(randomAllocationReview(costRoom, 'car', store.domain.assignment).scope, initial.scope);
  store.command('role', { id: ids.A, type: 'car', driver: true });
  assert.notEqual(review().scope, initial.scope);
  assert.equal(review().eligibleCount, 0);
  store.command('capacity', { type: 'car', groupId: groups.a, capacity: 4 });
  assert.notEqual(review().scope, initial.scope);
  const reset = structuredClone(store.getSnapshot()); reset.resetGeneration++;
  assert.notEqual(randomAllocationReview(reset, 'car', store.domain.assignment).scope, review().scope);
});

test('morning presentation retains duplicate identities and excludes private data and provenance', () => {
  const { store, ids } = allocationFixture();
  store.command('editParticipant', { id: ids.D, changes: { name: '同名' } });
  store.command('editParticipant', { id: ids.E, changes: { name: '同名' } });
  const view = allocationView(store.getSnapshot(), 'car', store.domain.canonical);
  const { text, duplicateNames } = allocationPresentation(view, '朝の企画');
  assert.deepEqual(duplicateNames, ['同名']);
  assert.equal(text.match(/同名/g).length, 2);
  assert.match(text, /朝の企画/);
  assert.match(text, /3人.*4人/);
  assert.match(text, /運転手.*C/);
  assert.doesNotMatch(text, /運転手.*A/);
  assert.match(text, /未割り当て/);
  for (const privateValue of ['private note', '4年', 'ランダム', ids.D, ids.E]) assert.equal(text.includes(privateValue), false);
});

test('existing manual move, owner reanchoring and fixed overflow preserve other allocation and settlement', () => {
  const { store, ids, groups } = allocationFixture();
  const before = structuredClone(store.getSnapshot());
  store.command('move', { id: ids.D, type: 'car', groupId: groups.b });
  assert.equal(store.getSnapshot().allocations.car.placements[ids.D].groupId, groups.b);
  assert.equal(store.getSnapshot().participants[ids.D].locked, true);
  store.command('move', { id: ids.A, type: 'car', groupId: groups.b });
  assert.notEqual(store.getSnapshot().allocations.car.groups[groups.a].ownerId, ids.A);
  assert.deepEqual(store.getSnapshot().allocations.team, before.allocations.team);
  assert.deepEqual(store.getSnapshot().settlement, before.settlement);
  const fresh = allocationFixture();
  fresh.store.command('capacity', { type: 'car', groupId: fresh.groups.a, capacity: 1 });
  assert.equal(fresh.store.getSnapshot().allocations.car.placements[fresh.ids.D].kind, 'waiting');
  assert.equal(fresh.store.getSnapshot().participants[fresh.ids.D].locked, true);
});
