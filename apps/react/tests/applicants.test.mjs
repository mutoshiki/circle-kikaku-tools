import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomStore } from '../src/store/room-store.js';
import { fixture, createReference, plain } from './reference.mjs';

const clock = { now: () => 2000, isServerAligned: () => true };
test('applicant selection creates only accepted participants and preserves manual choices and both allocations', () => {
  const store = createRoomStore({ initial: fixture, clock });
  const application = store.getSnapshot().meta.applicationSync;
  const entries = store.domain.applicants.applicantEntries(application);
  const accepted = new Set(entries.map(([, applicant]) => store.domain.applicants.participantIdForApplicant(store.getSnapshot(), applicant)));
  const manual = Object.keys(store.getSnapshot().participants).filter(id => !accepted.has(id));
  store.command('applySelection', { selectedApplicants: entries.map(([key]) => key), selectedManual: manual });
  const room = store.getSnapshot();
  assert.equal(Object.keys(room.participants).length, 7);
  for (const id of Object.keys(room.participants)) for (const type of ['car', 'team']) assert.ok(room.allocations[type].placements[id]);
  const removeId = manual[0];
  store.command('applySelection', { selectedApplicants: entries.map(([key]) => key), selectedManual: manual.filter(id => id !== removeId) });
  assert.ok(store.getSnapshot().participantTombstones[removeId]);
  assert.equal(store.getSnapshot().participants[removeId], undefined);
  for (const type of ['car', 'team']) assert.equal(store.getSnapshot().allocations[type].placements[removeId], undefined);
});

test('separate application metadata survives stale room paint; accepted grade/capacity follow the form', async () => {
  const { createApplicantSync } = await import('../src/sync/applicant-sync.js');
  const store = createRoomStore({ initial: fixture, clock });
  const before = structuredClone(store.getSnapshot());
  let callback;
  let subscriptions = 0;
  const transport = { subscribeApplicationMetadata(fn) { callback = fn; subscriptions++; return () => { subscriptions--; }; } };
  const service = createApplicantSync({ store, transport });
  service.start(); service.start();
  assert.equal(subscriptions, 1);
  const metadata = structuredClone(before.meta.applicationSync);
  const key = Object.keys(metadata.applicants)[0];
  metadata.applicants[key].grade = 4;
  metadata.applicants[key].capacity = 5;
  callback(metadata);
  const id = store.domain.applicants.participantIdForApplicant(store.getSnapshot(), metadata.applicants[key]);
  assert.equal(store.getSnapshot().participants[id].grade, 4);
  assert.equal(Object.values(store.getSnapshot().allocations.car.groups).find(group => group.ownerId === id).capacity, 5);
  store.receiveRemote(before);
  assert.equal(store.getSnapshot().meta.applicationSync.applicants[key].capacity, 5);
  assert.equal(store.getSnapshot().participants[id].grade, 4);
  service.dispose(); service.dispose();
  assert.equal(subscriptions, 0);
});

test('form response identity survives answer updates and a deleted applicant cannot be recreated', () => {
  const store = createRoomStore({ initial: fixture, clock });
  const responseKey = 'fixture-response-g';
  const selectedApplicants = Object.keys(store.getSnapshot().meta.applicationSync.applicants);
  const selectedManual = Object.keys(store.getSnapshot().participants);

  store.command('applySelection', { selectedApplicants, selectedManual });
  const selected = store.getSnapshot();
  const participantId = selected.meta.applicantParticipantIds[responseKey];
  assert.ok(participantId);
  assert.equal(selected.participants[participantId].name, '仮参加者G');

  const metadata = structuredClone(selected.meta.applicationSync);
  metadata.applicants[responseKey] = { ...metadata.applicants[responseKey], name: '回答更新後G', grade: 4, canDrive: true, capacity: 2 };
  store.receiveApplicationMetadata(metadata);
  store.command('syncApplicantDetails');
  const updated = store.getSnapshot();
  assert.equal(updated.meta.applicantParticipantIds[responseKey], participantId);
  assert.equal(updated.participants[participantId].name, '回答更新後G');
  assert.equal(updated.participants[participantId].grade, 4);
  const carGroup = Object.values(updated.allocations.car.groups).find(group => group.ownerId === participantId);
  assert.equal(carGroup.capacity, 2);
  assert.equal(updated.allocations.car.placements[participantId].driver, true);

  metadata.applicants[responseKey] = { ...metadata.applicants[responseKey], canDrive: false, capacity: 0 };
  store.receiveApplicationMetadata(metadata);
  store.command('syncApplicantDetails');
  const corrected = store.getSnapshot();
  assert.equal(Object.values(corrected.allocations.car.groups).some(group => group.ownerId === participantId), false);
  assert.equal(corrected.allocations.car.placements[participantId].kind, 'waiting');
  assert.equal(corrected.allocations.car.placements[participantId].driver, false);

  store.command('deleteParticipant', { id: participantId });
  store.command('applySelection', { selectedApplicants, selectedManual: Object.keys(store.getSnapshot().participants) });
  const deleted = store.getSnapshot();
  assert.equal(deleted.meta.applicantParticipantIds[responseKey], participantId);
  assert.ok(deleted.participantTombstones[participantId]);
  assert.equal(deleted.participants[participantId], undefined);
  assert.equal(Object.values(deleted.participants).some(person => person.name === '回答更新後G'), false);
});

test('schema 6 and legacy entity saves preserve React applicant identity metadata without owning applicationSync', () => {
  const reference = createReference();
  const base = reference.migrateAppData(fixture);
  base.meta.applicantParticipantIds = { 'fixture-response-a': 'p_legacy_identity' };
  const legacyLoaded = reference.migrateAppData(base);
  assert.deepEqual(plain(legacyLoaded.meta.applicantParticipantIds), { 'fixture-response-a': 'p_legacy_identity' });

  const legacyEdited = structuredClone(legacyLoaded);
  legacyEdited.roomName = 'legacy edit';
  const patch = reference.SanpoEntitySyncTest.buildEntityPatch(legacyLoaded, legacyEdited);
  assert.equal(Object.keys(patch).some(path => path.startsWith('meta/')), false);
  const saved = reference.SanpoEntitySyncTest.applyEntityPatchToObject(legacyLoaded, patch);
  assert.deepEqual(plain(saved.meta.applicantParticipantIds), { 'fixture-response-a': 'p_legacy_identity' });
  assert.deepEqual(plain(saved.meta.applicationSync), plain(fixture.meta.applicationSync));

  const react = createRoomStore({ initial: saved, clock });
  assert.deepEqual(plain(react.getSnapshot().meta.applicantParticipantIds), { 'fixture-response-a': 'p_legacy_identity' });
});
