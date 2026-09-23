import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomStore } from '../src/store/room-store.js';
import { fixture, createReference, plain } from './reference.mjs';
import { beginSettlementEdit, writeSettlementDraft, commitSettlementEdit, collectionChange, undoCollectionChange } from '../src/components/settlement/edit.js';

const create = () => createRoomStore({ initial: fixture, clientId: 'settlement-test', clock: { now: () => 1000 } });
const runtime = store => ({ store, sync: { flush: async () => {}, getSnapshot: () => ({ kind: 'local' }) } });

test('car editor writes narrow intent and preserves remote expenses, settings and Japanese draft', async () => {
  const store = create();
  const { data } = store.domain.settlementInput(store.getSnapshot());
  const car = data.cars[0];
  const edit = beginSettlementEdit(store, { car });
  edit.state.cars[car.name].extras.push({ id: 'new-local', name: '日本語変換中の駐車場代', amount: '300', type: 'club-minus' });
  const remote = structuredClone(store.getSnapshot());
  remote.settlement.rounding = '10';
  remote.settlement.carsByParticipantId[car.participantId].extras.push({ id: 'new-remote', name: '高速代', amount: '900', type: 'split' });
  store.receiveRemote(remote);
  let intent;
  store.subscribeIntents(value => { intent = value; });
  await commitSettlementEdit(runtime(store), edit);
  const result = store.domain.settlementInput(store.getSnapshot()).state;
  assert.equal(result.rounding, '10');
  assert.ok(result.cars[car.name].extras.some(row => row.name === '日本語変換中の駐車場代'));
  assert.ok(result.cars[car.name].extras.some(row => row.id === 'new-remote'));
  assert.ok(Object.keys(intent.patch).every(path => path.startsWith(`settlement/carsByParticipantId/${car.participantId}/`)));
  const reference = createReference();
  assert.deepEqual(plain(store.domain.settlement.calculateSettlement(data, result)), plain(reference.calculateSettlement(data, result)));
});

test('settings cancel changes nothing; failed save retains draft; reset rejects retry', async () => {
  const store = create();
  const before = store.getSnapshot();
  const cancel = beginSettlementEdit(store);
  cancel.state.driverReward = '1500';
  store.cancelEdit(cancel.session);
  assert.equal(store.getSnapshot(), before);
  const edit = beginSettlementEdit(store);
  edit.state.driverReward = '1500';
  const failed = { store, sync: { flush: async () => {}, getSnapshot: () => ({ kind: 'error', message: '保存できません' }) } };
  await assert.rejects(commitSettlementEdit(failed, edit), /保存できません/);
  assert.equal(edit.session.closed, false);
  assert.equal(edit.state.driverReward, '1500');
  const remote = structuredClone(store.getSnapshot());
  remote.resetGeneration++;
  store.receiveRemote(remote);
  await assert.rejects(commitSettlementEdit(runtime(store), edit), /リセット/);
});

test('standalone names, Times fees and signed expenses round trip through canonical storage', async () => {
  const store = createRoomStore();
  const settings = beginSettlementEdit(store, { standalone: true });
  settings.state.standalone = { enabled: true, driverCount: '1', memberCount: '3', driverNames: ['仮運転手'] };
  await commitSettlementEdit(runtime(store), settings);
  const car = store.domain.settlementInput(store.getSnapshot()).data.cars[0];
  const edit = beginSettlementEdit(store, { car });
  edit.state.cars[car.name] = { rentalType: 'times', dist: '100', extras: [{ name: 'タイムズ時間料金', amount: '2000', type: 'club', timesFeeKind: 'time' }, { id: 'refund', name: '返金', amount: '200', type: 'split-minus' }] };
  writeSettlementDraft(store, edit);
  await commitSettlementEdit(runtime(store), edit);
  const reload = createRoomStore({ initial: store.getSnapshot() });
  const { data, state } = reload.domain.settlementInput(reload.getSnapshot());
  const result = reload.domain.settlement.calculateSettlement(data, state);
  assert.equal(data.cars[0].name, '仮運転手');
  assert.equal(result.cars[0].timesDistanceFee, 1600);
  assert.equal(result.cars[0].splitExtras, -200);
  assert.equal(result.cars[0].clubExtras, 2000);
  assert.equal(result.perPerson, 400);
});

test('collection and payment Undo retain the legacy whole-map restore contract', () => {
  const store = create();
  const initial = store.domain.settlementInput(store.getSnapshot()).state;
  const names = store.domain.settlementInput(store.getSnapshot()).data.cars.map(car => car.name);
  const undo = collectionChange(store, { name: names[0], checked: true, payment: true });
  collectionChange(store, { name: names[1], checked: true, payment: true });
  undoCollectionChange(store, undo);
  assert.deepEqual(store.domain.settlementInput(store.getSnapshot()).state.driverPaid, initial.driverPaid);
  const paidUndo = collectionChange(store, { name: names[0], checked: true, collector: '仮集金者' });
  assert.equal(store.domain.settlementInput(store.getSnapshot()).state.paidBy[names[0]], '仮集金者');
  undoCollectionChange(store, paidUndo);
  assert.deepEqual(store.domain.settlementInput(store.getSnapshot()).state.paid, initial.paid);
});

test('different existing expense rows merge by ID while a car edit remains open', async () => {
  const store = create();
  const { data } = store.domain.settlementInput(store.getSnapshot());
  const car = data.cars[0];
  const edit = beginSettlementEdit(store, { car });
  const localRow = edit.state.cars[car.name].extras.find(row => row.id === 'extra-highway-a');
  localRow.amount = '2600';
  const remote = structuredClone(store.getSnapshot());
  const remoteRows = remote.settlement.carsByParticipantId[car.participantId].extras;
  remoteRows.find(row => row.id === 'extra-club-a').amount = '950';
  store.receiveRemote(remote);
  await commitSettlementEdit(runtime(store), edit);
  const rows = store.domain.settlementInput(store.getSnapshot()).state.cars[car.name].extras;
  assert.equal(rows.find(row => row.id === 'extra-highway-a').amount, '2600');
  assert.equal(rows.find(row => row.id === 'extra-club-a').amount, '950');
});

test('settings save publishes only changed settings and keeps remote car edits', async () => {
  const store = create();
  const edit = beginSettlementEdit(store);
  edit.state.rounding = '10';
  const car = store.domain.settlementInput(store.getSnapshot()).data.cars[0];
  const remote = structuredClone(store.getSnapshot());
  remote.settlement.carsByParticipantId[car.participantId].dist = '222';
  store.receiveRemote(remote);
  let intent;
  store.subscribeIntents(value => { intent = value; });
  await commitSettlementEdit(runtime(store), edit);
  assert.deepEqual(intent.patch, { 'settlement/rounding': '10' });
  const result = store.domain.settlementInput(store.getSnapshot()).state;
  assert.equal(result.rounding, '10');
  assert.equal(result.cars[car.name].dist, '222');
});
