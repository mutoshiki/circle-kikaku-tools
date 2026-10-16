import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomStore } from '../src/store/room-store.js';
import {
  getRandomizationConditionsKey,
  getRandomizationStatus,
  hasRandomizationTargets,
  getRandomizationConditionChanges,
  normalizeRandomizationHistory,
} from '../src/domain/randomization-history.js';
import { fixture } from './reference.mjs';

const room = () => {
  const value = structuredClone(createRoomStore({ initial: fixture }).getSnapshot());
  const ownerId = Object.keys(value.participants)[0];
  value.allocations.team.groups.team_fixture = { id: 'team_fixture', ownerId, capacity: 6, order: 0 };
  value.allocations.team.placements[ownerId] = { kind: 'member', groupId: 'team_fixture', driver: true, order: 0 };
  return value;
};
const group = (value, type = 'car') => Object.values(value.allocations[type].groups)[0];

test('status counts unique run IDs only when version and conditions match', () => {
  const value = room();
  const key = getRandomizationConditionsKey(value, 'car');
  const history = { version: 1, epochId: 'epoch-a', conditionsKey: key, runs: { a: true, b: true, c: true } };
  assert.deepEqual(normalizeRandomizationHistory(history, key), history);
  value.allocations.car.randomization = history;
  assert.deepEqual(getRandomizationStatus(value, 'car'), { count: 3, epochId: 'epoch-a', conditionsKey: key });
  assert.equal(normalizeRandomizationHistory(null, key), null);
  assert.equal(normalizeRandomizationHistory({ ...history, runs: [] }, key), null);
  assert.equal(normalizeRandomizationHistory({ ...history, conditionsKey: 'old' }, key), null);
  assert.equal(getRandomizationStatus(value, 'team').count, 0);
});

test('condition key ignores display-only edits and ordinary member moves', () => {
  const before = room();
  const after = structuredClone(before);
  const id = Object.keys(after.participants)[0];
  after.participants[id].name = '変更後の名前';
  after.participants[id].grade = 2;
  after.participants[id].memo = 'メモ';
  after.participants[id].updatedAt += 500;
  const member = Object.entries(after.allocations.car.placements).find(([, p]) => p.kind === 'member' && p.driver !== true);
  if (member) member[1].order += 10;
  assert.equal(getRandomizationConditionsKey(before, 'car'), getRandomizationConditionsKey(after, 'car'));
  assert.equal(getRandomizationConditionsKey(before, 'team'), getRandomizationConditionsKey(after, 'team'));
});

test('condition key tracks participant, shared fixed, group, role and fixed placement constraints', () => {
  const base = room();
  const key = type => getRandomizationConditionsKey(base, type);
  const participant = Object.keys(base.participants)[0];
  const changedParticipant = structuredClone(base);
  changedParticipant.participants['extra-person'] = { id: 'extra-person', name: '追加', locked: false };
  assert.notEqual(getRandomizationConditionsKey(changedParticipant, 'car'), key('car'));
  assert.notEqual(getRandomizationConditionsKey(changedParticipant, 'team'), key('team'));

  const fixed = structuredClone(base);
  fixed.participants[participant].locked = !fixed.participants[participant].locked;
  assert.notEqual(getRandomizationConditionsKey(fixed, 'car'), key('car'));
  assert.notEqual(getRandomizationConditionsKey(fixed, 'team'), key('team'));

  const capacity = structuredClone(base);
  group(capacity).capacity += 1;
  assert.notEqual(getRandomizationConditionsKey(capacity, 'car'), key('car'));
  assert.equal(getRandomizationConditionsKey(capacity, 'team'), key('team'));

  const teamCapacity = structuredClone(base);
  group(teamCapacity, 'team').capacity += 1;
  assert.equal(getRandomizationConditionsKey(teamCapacity, 'car'), key('car'));
  assert.notEqual(getRandomizationConditionsKey(teamCapacity, 'team'), key('team'));

  const role = structuredClone(base);
  const carPlacement = role.allocations.car.placements[participant];
  carPlacement.driver = !carPlacement.driver;
  assert.notEqual(getRandomizationConditionsKey(role, 'car'), key('car'));
  const teamOwner = group(role, 'team').ownerId;
  role.allocations.team.groups[Object.keys(role.allocations.team.groups)[0]].ownerId = participant === teamOwner ? Object.keys(role.participants)[1] : participant;
  assert.notEqual(getRandomizationConditionsKey(role, 'team'), key('team'));
});

test('condition changes identify participant, shared fixed and type-specific allocation changes', () => {
  const base = room();
  const participant = Object.keys(base.participants)[0];
  const add = structuredClone(base);
  add.participants['new'] = { id: 'new', name: '新規', locked: false };
  assert.deepEqual(getRandomizationConditionChanges(base, add), [
    { type: 'car', reason: 'participants' }, { type: 'team', reason: 'participants' },
  ]);

  const pin = structuredClone(base);
  pin.participants[participant].locked = !pin.participants[participant].locked;
  assert.deepEqual(getRandomizationConditionChanges(base, pin), [
    { type: 'car', reason: 'fixed' }, { type: 'team', reason: 'fixed' },
  ]);

  const cap = structuredClone(base);
  group(cap).capacity += 1;
  assert.deepEqual(getRandomizationConditionChanges(base, cap), [{ type: 'car', reason: 'allocation' }]);
});

test('randomization requires at least one movable person and at least one available slot', () => {
  const value = room();
  assert.equal(hasRandomizationTargets(value, 'car', { randomSlotsFromCanonical: () => [{ groupId: 'g', order: 0 }], isRandomlyMovablePlacement: () => true }), true);
  assert.equal(hasRandomizationTargets(value, 'car', { randomSlotsFromCanonical: () => [], isRandomlyMovablePlacement: () => true }), false);
  assert.equal(hasRandomizationTargets(value, 'car', { randomSlotsFromCanonical: () => [{}], isRandomlyMovablePlacement: () => false }), false);
  assert.equal(hasRandomizationTargets(value, 'invalid', { randomSlotsFromCanonical: () => [{}], isRandomlyMovablePlacement: () => true }), false);
});

