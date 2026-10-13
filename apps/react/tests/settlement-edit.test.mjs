import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomStore } from '../src/store/room-store.js';
import { fixture, createReference, plain } from './reference.mjs';
import { beginSettlementEdit, beginStandaloneDriverNameEdit, applyStandaloneDriverName, assertStandaloneDriverNameTargetCurrent, writeSettlementDraft, commitSettlementEdit, collectionChange, undoCollectionChange } from '../src/components/settlement/edit.js';

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

test('first count-only setup starts both counts at zero and persists the selected mode without count edits', async () => {
  const store = createRoomStore();
  const edit = beginSettlementEdit(store, { standalone: true });
  assert.equal(edit.state.standalone.driverCount, '0');
  assert.equal(edit.state.standalone.memberCount, '0');
  await commitSettlementEdit(runtime(store), edit);
  const reloaded = createRoomStore({ initial: store.getSnapshot() });
  assert.equal(reloaded.getSnapshot().settlement.standalone.enabled, true);
  assert.equal(reloaded.domain.settlementInput(reloaded.getSnapshot()).state.standalone.driverCount, '0');
});

test('saved count-only values and driver names remain the initial settings draft', async () => {
  const store = createRoomStore();
  const setup = beginSettlementEdit(store, { standalone: true });
  setup.state.standalone = { enabled: true, driverCount: '2', memberCount: '3', driverNames: ['運転手A', '運転手B'] };
  await commitSettlementEdit(runtime(store), setup);
  const edit = beginSettlementEdit(store, { standalone: true });
  assert.equal(edit.state.standalone.driverCount, '2');
  assert.equal(edit.state.standalone.memberCount, '3');
  assert.deepEqual(edit.state.standalone.driverNames, ['運転手A', '運転手B']);
});

test('renaming a count-only driver retains vehicle expenses and collection records under the new key', async () => {
  const store = createRoomStore();
  const setup = beginSettlementEdit(store, { standalone: true });
  setup.state.standalone = { enabled: true, driverCount: '1', memberCount: '2', driverNames: ['運転手A'] };
  await commitSettlementEdit(runtime(store), setup);
  const car = store.domain.settlementInput(store.getSnapshot()).data.cars[0];
  const vehicleEdit = beginSettlementEdit(store, { car });
  vehicleEdit.state.cars['運転手A'] = { rentalType: 'private', dist: '100', eco: '10', price: '170', extras: [{ id: 'expense-a', name: '駐車場', amount: '500', type: 'split' }] };
  vehicleEdit.state.paid['運転手A'] = true;
  vehicleEdit.state.paidBy['運転手A'] = '集金担当';
  vehicleEdit.state.driverPaid['運転手A'] = true;
  vehicleEdit.state.routePlanner.targetCarName = '運転手A';
  await commitSettlementEdit(runtime(store), vehicleEdit);

  const edit = beginStandaloneDriverNameEdit(store, 0);
  const outcome = applyStandaloneDriverName(edit, edit.state, '運転手B');
  assert.equal(outcome.ok, true);
  await commitSettlementEdit(runtime(store), edit);
  const { state } = store.domain.settlementInput(store.getSnapshot());
  assert.equal(state.cars['運転手B'].extras[0].id, 'expense-a');
  assert.equal(state.cars['運転手B'].extras[0].amount, '500');
  assert.equal(state.paid['運転手B'], true);
  assert.equal(state.paidBy['運転手B'], '集金担当');
  assert.equal(state.driverPaid['運転手B'], true);
  assert.equal(state.routePlanner.targetCarName, '運転手B');
  assert.equal(Object.hasOwn(state.cars, '運転手A'), false);
});

test('renaming to a synthetic passenger name is rejected without changing the draft', async () => {
  const store = createRoomStore();
  const setup = beginSettlementEdit(store, { standalone: true });
  setup.state.standalone = { enabled: true, driverCount: '1', memberCount: '2', driverNames: [] };
  await commitSettlementEdit(runtime(store), setup);
  const edit = beginStandaloneDriverNameEdit(store, 0);
  const beforeNames = structuredClone(edit.state.standalone.driverNames);
  const outcome = applyStandaloneDriverName(edit, edit.state, '参加者1');
  assert.equal(outcome.ok, false);
  assert.match(outcome.error, /別の車または参加者/);
  assert.deepEqual(edit.state.standalone.driverNames, beforeNames);
});

test('standalone driver rename refuses to overwrite a vehicle changed by another device', async () => {
  const store = createRoomStore();
  const setup = beginSettlementEdit(store, { standalone: true });
  setup.state.standalone = { enabled: true, driverCount: '1', memberCount: '0', driverNames: [] };
  await commitSettlementEdit(runtime(store), setup);

  const edit = beginStandaloneDriverNameEdit(store, 0);
  const remote = structuredClone(store.getSnapshot());
  remote.settlement.standalone.driverNames = ['別端末の名前'];
  store.receiveRemote(remote);

  assert.throws(() => assertStandaloneDriverNameTargetCurrent(store, edit), /別の端末で変更/);
  assert.equal(edit.oldName, '車出し1');
});

test('standalone driver rename refuses stale expenses and a newly conflicting vehicle name', async () => {
  const store = createRoomStore();
  const setup = beginSettlementEdit(store, { standalone: true });
  setup.state.standalone = { enabled: true, driverCount: '2', memberCount: '0', driverNames: ['運転手A', '運転手B'] };
  await commitSettlementEdit(runtime(store), setup);

  const expenseEdit = beginStandaloneDriverNameEdit(store, 0);
  const expenseRemote = structuredClone(store.getSnapshot());
  expenseRemote.settlement.carsByName['運転手A'] = { rentalType: 'private', dist: '10', eco: '10', price: '100', extras: [{ id: 'remote-expense', name: '駐車場', amount: '500', type: 'split' }] };
  store.receiveRemote(expenseRemote);
  assert.throws(() => assertStandaloneDriverNameTargetCurrent(store, expenseEdit), /別の端末で変更/);

  const nameStore = createRoomStore();
  const nameSetup = beginSettlementEdit(nameStore, { standalone: true });
  nameSetup.state.standalone = { enabled: true, driverCount: '2', memberCount: '0', driverNames: ['運転手A', '運転手B'] };
  await commitSettlementEdit(runtime(nameStore), nameSetup);
  const nameEdit = beginStandaloneDriverNameEdit(nameStore, 0);
  const nameRemote = structuredClone(nameStore.getSnapshot());
  nameRemote.settlement.standalone.driverNames[1] = '衝突予定の名前';
  nameStore.receiveRemote(nameRemote);
  assert.throws(() => assertStandaloneDriverNameTargetCurrent(nameStore, nameEdit), /別の端末で変更/);
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
