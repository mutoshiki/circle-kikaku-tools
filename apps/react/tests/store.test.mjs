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

test('car capacity leaves its stated number of passenger seats after the owner', () => {
  const store = create();
  const room = plain(store.getSnapshot());
  const allocation = room.allocations.car;
  const group = Object.values(allocation.groups)[0];
  group.capacity = 2;
  const waitingIds = Object.entries(allocation.placements)
    .filter(([, placement]) => placement.kind === 'waiting')
    .map(([id]) => id)
    .slice(0, 2);
  waitingIds.forEach((id, index) => {
    allocation.placements[id] = { kind: 'member', driver: false, groupId: group.id, order: index, updatedAt: 1001 + index };
  });

  const normalized = store.domain.canonical.migrate(room);
  const passengers = Object.values(normalized.allocations.car.placements)
    .filter(placement => placement.kind === 'member' && placement.groupId === group.id && placement !== normalized.allocations.car.placements[group.ownerId]);
  assert.equal(passengers.length, 2);
});

test('team capacity includes the owner and rejects an extra member without changing the snapshot', () => {
  const store = create();
  const ids = Object.keys(store.getSnapshot().participants);
  const [ownerId, ...memberIds] = ids;
  store.command('createGroup', { type: 'team', ownerId, capacity: 5 });
  const group = Object.values(store.getSnapshot().allocations.team.groups).find(item => item.ownerId === ownerId);
  memberIds.slice(0, 4).forEach(id => store.command('move', { id, type: 'team', groupId: group.id }));
  const fullSnapshot = store.getSnapshot();
  const rejectedId = memberIds[4];

  assert.throws(() => store.command('move', { id: rejectedId, type: 'team', groupId: group.id }), /空席/);
  assert.equal(store.getSnapshot(), fullSnapshot);
  assert.equal(store.getSnapshot().allocations.team.placements[rejectedId].kind, 'waiting');
  assert.equal(Object.values(store.getSnapshot().allocations.team.placements).filter(placement => placement.kind === 'member' && placement.groupId === group.id).length, 5);
});

test('car capacity still admits its stored number of passengers after the owner', () => {
  const store = create();
  const [ownerId, ...memberIds] = Object.keys(store.getSnapshot().participants);
  store.command('createGroup', { type: 'car', ownerId, capacity: 3 });
  const group = Object.values(store.getSnapshot().allocations.car.groups).find(item => item.ownerId === ownerId);
  memberIds.slice(0, 3).forEach(id => store.command('move', { id, type: 'car', groupId: group.id }));
  assert.equal(Object.values(store.getSnapshot().allocations.car.placements).filter(placement => placement.kind === 'member' && placement.groupId === group.id).length, 4);
});

test('team group creation preserves capacity 100 instead of clamping it to 99', () => {
  const store = create();
  const [ownerId, carOwnerId] = Object.keys(store.getSnapshot().participants);
  store.command('createGroup', { type: 'team', ownerId, capacity: 100 });
  const group = Object.values(store.getSnapshot().allocations.team.groups).find(item => item.ownerId === ownerId);
  assert.equal(group.capacity, 100);
  store.command('createGroup', { type: 'car', ownerId: carOwnerId, capacity: 100 });
  const carGroup = Object.values(store.getSnapshot().allocations.car.groups).find(item => item.ownerId === carOwnerId);
  assert.equal(carGroup.capacity, 99);
});

test('random assignment leaves no movable member waiting when team capacity is available', () => {
  const store = create();
  const room = plain(store.getSnapshot());
  const allocation = room.allocations.team;
  const participantIds = Object.keys(room.participants);
  const owners = participantIds.slice(0, 2);
  const [fixedId, ...movableIds] = participantIds.slice(2, 6);
  allocation.groups = {
    team_a: { id: 'team_a', ownerId: owners[0], capacity: 3, order: 0, displayIndex: 1 },
    team_b: { id: 'team_b', ownerId: owners[1], capacity: 3, order: 1, displayIndex: 2 },
  };
  allocation.placements = Object.fromEntries(Object.keys(room.participants).map((id, index) => [id, {
    kind: 'waiting', driver: false, groupId: '', order: index,
  }]));
  owners.forEach((id, index) => {
    allocation.placements[id] = { kind: 'member', driver: true, groupId: `team_${index ? 'b' : 'a'}`, order: 0 };
  });
  allocation.placements[fixedId] = { kind: 'member', driver: false, groupId: 'team_a', order: 1 };
  room.participants[fixedId].locked = true;
  participantIds.filter(id => id !== fixedId && !owners.includes(id) && !movableIds.includes(id)).forEach(id => { room.participants[id].locked = true; });
  const randomized = createRoomStore({ initial: room, random: () => 0, clock: { now: () => 2000 } });

  assert.equal(randomized.domain.assignment.randomSlotsFromCanonical(randomized.getSnapshot().allocations.team, randomized.getSnapshot().participants).length, 3);
  randomized.command('randomize', { type: 'team' });
  const result = randomized.getSnapshot().allocations.team;
  const waiting = movableIds.filter(id => result.placements[id].kind === 'waiting');
  assert.deepEqual(waiting, []);
  for (const group of Object.values(result.groups)) {
    assert.ok(Object.values(result.placements).filter(placement => placement.kind === 'member' && placement.groupId === group.id).length <= group.capacity);
  }
});

test('random assignment gives a one-person team zero member slots', () => {
  const store = create();
  const room = plain(store.getSnapshot());
  const ownerId = Object.keys(room.participants)[0];
  const allocation = room.allocations.team;
  const groupId = 'team_single';
  allocation.groups = { [groupId]: { id: groupId, ownerId, capacity: 1, order: 0, displayIndex: 1 } };
  allocation.placements = Object.fromEntries(Object.keys(room.participants).map((id, index) => [id, {
    kind: id === ownerId ? 'member' : 'waiting', driver: id === ownerId, groupId: id === ownerId ? groupId : '', order: index,
  }]));
  const randomized = createRoomStore({ initial: room, random: () => 0, clock: { now: () => 2000 } });

  randomized.command('randomize', { type: 'team' });
  const result = randomized.getSnapshot().allocations.team;
  assert.equal(Object.values(result.placements).filter(placement => placement.kind === 'member' && placement.groupId === groupId).length, 1);
  assert.equal(Object.values(result.placements).filter(placement => placement.kind === 'waiting').length, Object.keys(room.participants).length - 1);
  assert.equal(randomized.domain.assignment.randomSlotsFromCanonical(result, randomized.getSnapshot().participants).length, 0);
});

test('allocation group labels are stable and new teams count the leader in total capacity', () => {
  const store = create();
  let room = plain(store.getSnapshot());
  const waitingIds = Object.entries(room.allocations.team.placements).filter(([, placement]) => placement.kind === 'waiting').map(([id]) => id);
  for (const ownerId of waitingIds.slice(0, 3)) store.command('createGroup', { type: 'team', ownerId, capacity: 5 });
  room = plain(store.getSnapshot());
  let projected = store.domain.canonical.projectAllocation(room, 'team');
  assert.deepEqual(projected.cars.map(group => group.groupDisplayName), ['A班', 'B班', 'C班']);
  assert.equal(projected.cars[0].displayMemberCount, projected.cars[0].members.length + 1);
  const firstOwner = projected.cars[0].participantId;
  const firstCount = projected.cars[0].displayMemberCount;
  store.command('role', { id: firstOwner, type: 'team', driver: false });
  assert.equal(store.domain.canonical.projectAllocation(store.getSnapshot(), 'team').cars[0].displayMemberCount, firstCount);
  const deleted = room.allocations.team.groups[projected.cars[1].groupId];
  store.command('deleteGroup', { type: 'team', groupId: deleted.id });
  room = plain(store.getSnapshot());
  const waitingId = deleted.ownerId;
  store.command('createGroup', { type: 'team', ownerId: waitingId, capacity: 5 });
  room = plain(store.getSnapshot());
  projected = store.domain.canonical.projectAllocation(room, 'team');
  assert.deepEqual(projected.cars.map(group => group.groupDisplayName), ['A班', 'C班', 'D班']);
  assert.equal(projected.cars.at(-1).capacity, 5);
  const displayNames = projected.cars.map(group => group.groupDisplayName);
  const oldClientProjection = projected.cars.map(({ displayIndex, ...car }) => car);
  store.domain.canonical.applyProjectedPlan(room, { name: '班割', cars: oldClientProjection, waiting: projected.waiting }, 'team');
  const roundTripped = store.domain.canonical.projectAllocation(store.domain.migrate(room), 'team');
  assert.deepEqual(roundTripped.cars.map(group => group.groupDisplayName), displayNames);
});

test('allocation labels progress from Z to AA and car and team sequences stay independent', () => {
  const store = create();
  const room = plain(store.getSnapshot());
  for (const type of ['car', 'team']) {
    const allocation = room.allocations[type];
    allocation.groups = {};
    allocation.placements = {};
    allocation.nextDisplayIndex = 28;
    for (let index = 1; index <= 27; index++) {
      const id = `label_${type}_${index}`;
      room.participants[id] = { id, name: `${type}-${index}`, memo: '', gender: 'unknown', grade: 0, flag: 'none', locked: false };
      const groupId = `group_${type}_${index}`;
      allocation.groups[groupId] = { id: groupId, ownerId: id, displayIndex: index, capacity: 5, order: index - 1, createdAt: index };
      allocation.placements[id] = { kind: 'member', driver: true, groupId, order: index - 1 };
    }
  }
  const cars = store.domain.canonical.projectAllocation(room, 'car').cars;
  const teams = store.domain.canonical.projectAllocation(room, 'team').cars;
  assert.equal(cars[25].groupDisplayName, 'Z車');
  assert.equal(cars[26].groupDisplayName, 'AA車');
  assert.equal(teams[25].groupDisplayName, 'Z班');
  assert.equal(teams[26].groupDisplayName, 'AA班');
});

test('moving a group owner preserves the source group anchor and does not reuse deleted labels', () => {
  const store = create();
  const room = plain(store.getSnapshot());
  const waitingIds = Object.entries(room.allocations.team.placements)
    .filter(([, placement]) => placement.kind === 'waiting')
    .map(([id]) => id);
  const [ownerId, targetOwnerId, replacementId] = waitingIds;
  store.command('createGroup', { type: 'team', ownerId, capacity: 5 });
  store.command('createGroup', { type: 'team', ownerId: targetOwnerId, capacity: 5 });
  const firstGroup = Object.values(store.getSnapshot().allocations.team.groups).find(group => group.ownerId === ownerId);
  const targetGroup = Object.values(store.getSnapshot().allocations.team.groups).find(group => group.ownerId === targetOwnerId);
  store.command('move', { id: replacementId, type: 'team', groupId: firstGroup.id });
  store.command('move', { id: ownerId, type: 'team', groupId: targetGroup.id });
  const afterMove = plain(store.getSnapshot());
  assert.equal(afterMove.allocations.team.groups[firstGroup.id].ownerId, replacementId);
  assert.equal(afterMove.allocations.team.placements[ownerId].groupId, targetGroup.id);
  assert.deepEqual(store.domain.canonical.projectAllocation(afterMove, 'team').cars.map(group => group.groupDisplayName), ['A班', 'B班']);
  store.command('move', { id: replacementId, type: 'team' });
  const afterLastMemberLeaves = plain(store.getSnapshot());
  assert.equal(afterLastMemberLeaves.allocations.team.groups[firstGroup.id], undefined);
  assert.equal(afterLastMemberLeaves.allocations.team.nextDisplayIndex, 3);
  store.command('createGroup', { type: 'team', ownerId: replacementId, capacity: 5 });
  assert.equal(store.domain.canonical.projectAllocation(store.getSnapshot(), 'team').cars.at(-1).groupDisplayName, 'C班');
});

test('concurrent new groups retain unique labels after the versioned room merge', () => {
  const baselineStore = create();
  const baseline = plain(baselineStore.getSnapshot());
  const waitingIds = Object.entries(baseline.allocations.team.placements).filter(([, placement]) => placement.kind === 'waiting').map(([id]) => id);
  const left = createRoomStore({ initial: baseline, clientId: 'left', clock: { now: () => 2000 } });
  const right = createRoomStore({ initial: baseline, clientId: 'right', clock: { now: () => 2000 } });
  left.command('createGroup', { type: 'team', ownerId: waitingIds[0], capacity: 5 });
  right.command('createGroup', { type: 'team', ownerId: waitingIds[1], capacity: 5 });
  const local = plain(right.getSnapshot());
  const remote = plain(left.getSnapshot());
  const rightSync = right.domain.sync;
  const leftSync = left.domain.sync;
  const mergedRight = rightSync.applyVersionedEntityPatch(remote, baseline, local, rightSync.buildEntityPatch(baseline, local), 1, 'concurrent-group', 2000);
  const mergedLeft = leftSync.applyVersionedEntityPatch(local, baseline, remote, leftSync.buildEntityPatch(baseline, remote), 1, 'concurrent-group', 2000);
  const rightCars = right.domain.canonical.projectAllocation(mergedRight, 'team').cars;
  const leftCars = left.domain.canonical.projectAllocation(mergedLeft, 'team').cars;
  const labels = rightCars.map(group => group.groupDisplayName);
  assert.equal(new Set(labels).size, labels.length);
  assert.deepEqual(Object.fromEntries(rightCars.map(group => [group.participantId, group.groupDisplayName])), Object.fromEntries(leftCars.map(group => [group.participantId, group.groupDisplayName])));
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
