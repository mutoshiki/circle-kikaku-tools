import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomStore } from '../src/store/room-store.js';
import { fixture, createReference, plain } from './reference.mjs';
import { vehicleCostTargets, resolveVehicleCostTarget, vehicleCostTargetForGroup, vehicleCostFees, validateVehicleCost } from '../src/ui/vehicle-cost-target.js';

const create = () => createRoomStore({ initial: fixture, clock: { now: () => 1000 } });

test('cost target follows the structural anchor despite missing or multiple driver roles', () => {
  const store = create(), domain = store.domain;
  const first = domain.settlementInput(store.getSnapshot()).data.cars[0];
  store.command('role', { type: 'car', id: first.participantId, driver: false });
  for (const member of first.members) store.command('role', { type: 'car', id: member.participantId, driver: true });
  const room = store.getSnapshot(), targets = vehicleCostTargets(room, domain);
  assert.equal(targets.length, 2);
  assert.equal(targets[0].key, 'participant:p_1xeyc8h');
  assert.equal(targets[0].editable, true);
  assert.equal(vehicleCostTargetForGroup(room, domain, first.groupId).key, targets[0].key);
  assert.equal(vehicleCostTargetForGroup(room, domain, 'gone'), null);
  assert.equal(resolveVehicleCostTarget(targets, 'participant:gone'), null);
});

test('standalone car retains the exact Japanese fallback identity', () => {
  const store = createRoomStore();
  const state = store.domain.settlementInput(store.getSnapshot()).state;
  state.standalone = { enabled: true, driverCount: '1', memberCount: '3', driverNames: ['田中:/車'] };
  store.command('settlement', { state });
  const targets = vehicleCostTargets(store.getSnapshot(), store.domain);
  assert.equal(targets.length, 1);
  assert.equal(targets[0].key, 'name:田中:/車');
  assert.equal(resolveVehicleCostTarget(targets, targets[0].key).car.name, '田中:/車');
  assert.equal(targets[0].editable, true);
});

test('duplicate name projection is exposed rather than guessed into an ID-backed save', () => {
  const store = create();
  const cars = store.domain.settlementInput(store.getSnapshot()).data.cars;
  for (const car of cars) store.command('editParticipant', { id: car.participantId, changes: { name: '同名' } });
  const room = store.getSnapshot(), before = JSON.stringify(room);
  const projected = store.domain.settlementInput(room).state;
  const converted = store.domain.canonical.settlementToStorage(projected, room.participants);
  assert.ok(Object.keys(converted.carsByParticipantId).length < cars.length);
  const targets = vehicleCostTargets(room, store.domain);
  assert.equal(targets.length, 2);
  assert.ok(targets.every(t => !t.editable && t.reason));
  assert.notEqual(targets[0].key, targets[1].key);
  assert.equal(JSON.stringify(room), before);
});

test('hidden invalid fee has a corrective field link and other car issues do not block it', () => {
  const store = create(), domain = store.domain;
  const { data, state } = domain.settlementInput(store.getSnapshot());
  const target = vehicleCostTargets(store.getSnapshot(), domain)[0];
  Object.assign(state.cars[target.car.name], { dist: '100', eco: '10', price: '150' });
  state.cars[data.cars[1].name].dist = '';
  state.cars[target.car.name].extras.push({ id: 'hidden', name: '入浴', amount: '', type: 'split' });
  let fees = vehicleCostFees(state.cars[target.car.name], domain);
  let issues = validateVehicleCost({ data, state, target, domain, fees });
  assert.equal(issues.valid, false);
  assert.ok(issues.fields.some(f => f.feeKey === 'extra:hidden' && f.field === 'amount'));
  state.cars[target.car.name].extras.at(-1).amount = '0';
  fees = vehicleCostFees(state.cars[target.car.name], domain);
  issues = validateVehicleCost({ data, state, target, domain, fees });
  assert.equal(issues.valid, true);
  assert.deepEqual(issues.fields, []);
});

test('standard fees cannot be deleted and idless fee locators follow the original row', () => {
  const store = create(), domain = store.domain;
  const car = domain.settlement.ensureDriverRewardExtra({ extras: [{ name: '入浴', amount: '0', type: 'split' }] }, { ...domain.settlement.getDefaultSettlementState(), driverReward: '500' });
  const fees = vehicleCostFees(car, domain), extra = fees.find(f => f.row?.name === '入浴');
  assert.equal(fees[0].key, 'movement');
  assert.equal(fees[0].removable, false);
  assert.equal(fees.find(f => domain.settlement.isDriverRewardExtra(f.row || {})).removable, false);
  car.extras.reverse();
  assert.equal(vehicleCostFees(car, domain).find(f => f.row === extra.row).key, extra.key);
  assert.equal(extra.removable, true);
});

test('large amounts signed categories pending blanks and Times dormant values retain domain semantics', () => {
  const store = create(), domain = store.domain;
  const { data, state } = domain.settlementInput(store.getSnapshot());
  const target = vehicleCostTargets(store.getSnapshot(), domain)[0], car = state.cars[target.car.name];
  Object.assign(car, { dist: '1000000', eco: '10', price: '150', extras: [{ id: 'signed', name: '返金', amount: '1000000000', type: 'club-minus' }, { id: 'pending', name: '', amount: '', pending: true, type: 'split' }] });
  const check = () => validateVehicleCost({ data, state, target, domain, fees: vehicleCostFees(car, domain) });
  assert.equal(check().valid, false);
  assert.ok(check().fields.some(f => f.feeKey === 'extra:pending' && f.field === 'name'));
  car.extras.pop();
  assert.equal(check().valid, true);
  car.extras[0].amount = '−1';
  assert.ok(check().fields.some(f => f.feeKey === 'extra:signed' && f.field === 'amount'));
  car.extras[0].amount = '0';
  assert.equal(check().valid, true);
  car.rentalType = 'times';
  const normalized = domain.settlement.normalizeSettlementState(state);
  assert.equal(normalized.cars[target.car.name].eco, '10');
  assert.equal(normalized.cars[target.car.name].price, '150');
  const pending = domain.settlement.normalizeCarSettlementState({ extras: [{ id: 'pending', name: '', amount: '', pending: true }] });
  assert.equal(pending.extras[0].pending, true);
  assert.deepEqual(plain(domain.settlement.calculateSettlement(data, normalized)), plain(createReference().calculateSettlement(data, normalized)));
});
