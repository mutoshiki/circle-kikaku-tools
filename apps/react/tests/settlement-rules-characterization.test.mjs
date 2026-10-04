import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, createReference, plain } from './reference.mjs';
import { createRoomStore } from '../src/store/room-store.js';
import { beginSettlementEdit, writeSettlementDraft } from '../src/components/settlement/edit.js';

// Changing normalization, roles, either rounding scope or signed expense handling
// must fail these full-result comparisons with the independent legacy owner.
for (const standalone of [false, true]) for (const flags of ['normal', 'offset', 'free', 'both'])
for (const rounding of ['1', '10', '100', '50']) for (const funding of ['split', 'club'])
test(`protected rules calculation: ${standalone ? 'standalone' : 'registered'} / ${flags} / ${rounding} / ${funding}`, () => {
  const store = createRoomStore({ initial: fixture }), domain = store.domain;
  const room = structuredClone(store.getSnapshot());
  Object.assign(room.settlement, { rounding, organizerFree: true, driverReward: '700', driverRewardType: funding,
    driverCollectionOffset: ['offset', 'both'].includes(flags), driverCollectionFree: ['free', 'both'].includes(flags) });
  if (standalone) room.settlement.standalone = { enabled: true, driverCount: '2', memberCount: '4', driverNames: ['車甲', '車乙'] };
  for (const car of Object.values(room.settlement.carsByParticipantId || {})) {
    car.extras.push({ id: 'pending', name: '', amount: '', type: 'club' }, { id: 'signed', name: '調整', amount: '-50', type: 'split' });
  }
  const { data, state } = domain.settlementInput(room);
  assert.deepEqual(plain(domain.settlement.calculateSettlement(data, state)), plain(createReference().calculateSettlement(data, state)));
});

test('owner and explicit driver roles remain independent, including multiple drivers and driver organizer', () => {
  const store = createRoomStore({ initial: fixture }), room = structuredClone(store.getSnapshot()), domain = store.domain;
  const allocation = room.allocations.car;
  const group = Object.values(allocation.groups)[0];
  allocation.placements[group.ownerId].driver = false;
  const passengers = Object.entries(allocation.placements).filter(([id, p]) => id !== group.ownerId && p.groupId === group.id);
  for (const [, p] of passengers) p.driver = true;
  room.settlement.organizerParticipantId = passengers[0][0];
  for (const organizerFree of [false, true]) {
    room.settlement.organizerFree = organizerFree;
    const { data, state } = domain.settlementInput(room);
    assert.deepEqual(plain(domain.settlement.calculateSettlement(data, state)), plain(createReference().calculateSettlement(data, state)));
  }
});

test('raw counts and reward have different existing numeric acceptance; names normalize only in domain projection', () => {
  const domain = createRoomStore().domain.settlement;
  const cases = [['', '', 0], ['0', '0', 0], ['1,000', '', 1000], ['0.5', '0', 0.5], ['100', '99', 100], ['-1', '', 0], ['−1', '', 0]];
  for (const [raw, count, reward] of cases) {
    assert.equal(domain.clampStandaloneCount(raw), count, raw);
    assert.equal(domain.getDriverRewardAmount({ driverReward: raw }), reward, raw);
    // The previous step guard checks the raw sum, not normalized integer counts.
    assert.equal(Number(raw) + Number('0') <= 0, ['', '0', '-1'].includes(raw), raw);
  }
  assert.deepEqual(domain.getStandaloneDriverNames({ driverCount: '3', driverNames: ['', ' 同名 ', '同名'] }), ['車出し1', '同名', '同名2']);
});

test('unrelated rule edit changes only its setting, preserving costs, collection, participants and both allocations', () => {
  const store = createRoomStore({ initial: fixture }), before = store.getSnapshot();
  const edit = beginSettlementEdit(store); edit.state.rounding = '10'; writeSettlementDraft(store, edit);
  let intent; store.subscribeIntents(value => { intent = value; });
  store.commitEdit(edit.session);
  assert.deepEqual(intent.patch, { 'settlement/rounding': '10' });
  const after = store.getSnapshot();
  for (const key of ['participants', 'allocations', 'overview']) assert.deepEqual(after[key], before[key]);
  const expected = structuredClone(before.settlement); expected.rounding = '10';
  assert.deepEqual(after.settlement, expected);
});
