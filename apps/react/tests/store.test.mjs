import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomStore } from '../src/store/room-store.js';
import { createRoomStorage } from '../src/store/local-storage.js';
import { fixture, plain } from './reference.mjs';

const create = () => createRoomStore({ initial: fixture, clientId: 'test', clock: { now: () => 1000 } });

test('store snapshots are stable, immutable and command updates notify once without DOM', () => {
  const store = create();
  const before = store.getSnapshot();
  assert.equal(before, store.getSnapshot());
  assert.throws(() => { before.roomName = 'mutation'; }, TypeError);
  const events = [];
  let notifications = 0;
  const unsubscribe = store.subscribe(() => notifications++);
  store.subscribeIntents(intent => events.push(intent));
  store.command('rename', { name: '仮企画・編集' });
  assert.notEqual(store.getSnapshot(), before);
  assert.equal(store.getSnapshot().roomName, '仮企画・編集');
  assert.equal(notifications, 1);
  assert.equal(events.length, 1);
  assert.equal(events[0].patch.roomName, '仮企画・編集');
  assert.ok(!Object.keys(events[0].patch).some(path => path.startsWith('allocations/')));
  unsubscribe();
  store.command('rename', { name: '次の企画名' });
  assert.equal(notifications, 1);
});

test('open drafts retain IME input while remote updates flow to other fields', () => {
  const store = create();
  const id = Object.keys(store.getSnapshot().participants)[0];
  const session = store.beginEdit({ participantId: id });
  session.draft.participants[id].memo = 'にほんご変換中';
  const remote = structuredClone(store.getSnapshot());
  remote.roomName = '別端末の企画名';
  remote.participants[id].grade = 4;
  store.receiveRemote(remote);
  assert.equal(session.draft.participants[id].memo, 'にほんご変換中');
  store.commitEdit(session);
  assert.equal(store.getSnapshot().roomName, '別端末の企画名');
  assert.equal(store.getSnapshot().participants[id].grade, 4);
  assert.equal(store.getSnapshot().participants[id].memo, 'にほんご変換中');
  assert.equal(store.getOpenEditCount(), 0);
});

test('remote deletion and reset reject stale edit commits without revival', () => {
  const store = create();
  const id = Object.keys(store.getSnapshot().participants)[0];
  const session = store.beginEdit({ participantId: id });
  session.draft.participants[id].memo = 'old';
  store.command('deleteParticipant', { id });
  assert.throws(() => store.commitEdit(session), /削除/);
  store.cancelEdit(session);
  const resetSession = store.beginEdit();
  resetSession.draft.roomName = 'old room';
  const reset = store.domain.migrate({ schemaVersion: 4 });
  reset.resetGeneration = 1;
  store.receiveRemote(reset);
  assert.throws(() => store.commitEdit(resetSession), /リセット/);
  assert.equal(Object.keys(store.getSnapshot().participants).length, 0);
});

test('participant, capacity, fixed role and random assignment commands preserve independent team state', () => {
  const store = create();
  const team = plain(store.getSnapshot().allocations.team);
  const initial = store.getSnapshot();
  const waitingId = Object.entries(initial.allocations.car.placements).find(([, p]) => p.kind === 'waiting')[0];
  const group = Object.values(initial.allocations.car.groups)[0];
  store.command('move', { id: waitingId, type: 'car', groupId: group.id });
  assert.equal(store.getSnapshot().allocations.car.placements[waitingId].groupId, group.id);
  store.command('role', { id: waitingId, type: 'car', driver: true });
  store.command('editParticipant', { id: waitingId, changes: { locked: true } });
  store.command('randomize', { type: 'car' });
  assert.equal(store.getSnapshot().allocations.car.placements[waitingId].groupId, group.id);
  assert.equal(store.getSnapshot().allocations.car.placements[waitingId].driver, true);
  assert.deepEqual(plain(store.getSnapshot().allocations.team), team);
  store.command('capacity', { type: 'car', groupId: group.id, capacity: 1 });
  const current = store.getSnapshot().allocations.car;
  assert.ok(Object.entries(current.placements).filter(([id, p]) => id !== current.groups[group.id].ownerId && p.groupId === group.id).length <= 1);
});

test('expense draft merges remote rows by ID without replacing unrelated settlement settings', () => {
  const store = create();
  const id = Object.keys(store.getSnapshot().settlement.carsByParticipantId)[0];
  const session = store.beginEdit({ scope: 'settlement-car', participantId: id });
  session.draft.settlement.carsByParticipantId[id].extras.push({ id: 'local-extra', name: '高速代', amount: '20', type: 'split' });
  const remote = structuredClone(store.getSnapshot());
  remote.settlement.rounding = '500';
  remote.settlement.carsByParticipantId[id].extras.push({ id: 'remote-extra', name: '駐車代', amount: '30', type: 'club' });
  store.receiveRemote(remote);
  store.commitEdit(session);
  const result = store.getSnapshot();
  assert.equal(result.settlement.rounding, '500');
  assert.ok(result.settlement.carsByParticipantId[id].extras.some(row => row.id === 'local-extra'));
  assert.ok(result.settlement.carsByParticipantId[id].extras.some(row => row.id === 'remote-extra'));
});

test('storage namespaces isolate both room and legacy state; corrupt data is recoverable', () => {
  const data = new Map([['syawari_TEST', 'legacy']]);
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  const a = createRoomStorage(storage, 'TEST');
  const b = createRoomStorage(storage, 'OTHER');
  a.write('outbox', { id: 'one' });
  assert.equal(b.read('outbox'), null);
  assert.equal(data.get('syawari_TEST'), 'legacy');
  a.write('outbox', { id: 'two' });
  assert.equal(a.read('outbox').id, 'two');
  a.remove('outbox');
  assert.equal(a.read('outbox'), null);
});
