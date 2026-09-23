import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStorage, createHistoryService } from '../src/services/history.js';
import { prepareCompatibleUrl, createShareUrl, tokenStorageKey } from '../src/services/url-compat.js';
import { createProjectDomain } from '../src/services/project-domain.js';
import { createDomain } from '../src/domain/index.js';

const participant = (name, grade = 1) => ({ name, grade, memo: '', flag: 'none', locked: false, updatedAt: 1 });

test('overview draft remains local until explicit shared save', () => {
  const storage = createMemoryStorage();
  const history = { calls: [], replaceState(...args) { this.calls.push(args); } };
  const location = { href: 'https://example.test/react/?room=ROOM-A&view=sheet&allocation=car' };
  const url = prepareCompatibleUrl({ location, history, storage, crypto: { randomUUID: () => 'abcd-1234' } });
  assert.equal(url.roomId, 'ROOM-A');
  assert.equal(url.initialView, 1);
  assert.equal(new URL(url.href).search, '?room=ROOM-A');
  assert.equal(createShareUrl(url.href), 'https://example.test/react/?room=ROOM-A');
});

test('handoff capability is room-local and removed from URL before sharing', () => {
  const storage = createMemoryStorage();
  const token = `h_${'A'.repeat(48)}`;
  const history = { value: '', replaceState(_state, _title, value) { this.value = value; } };
  const result = prepareCompatibleUrl({ location: { href: `https://example.test/react/?room=ROOM-A&handoff=${token}` }, history, storage, crypto: { randomUUID: () => 'unused' } });
  assert.equal(result.handoffToken, token);
  assert.equal(storage.getItem(tokenStorageKey('ROOM-A')), token);
  assert.equal(new URL(`https://example.test${history.value}`).searchParams.has('handoff'), false);
  assert.equal(createShareUrl(result.href).includes('handoff'), false);
  assert.equal(storage.getItem(tokenStorageKey('ROOM-B')), null);
});

test('history keeps legacy shape, isolates rooms, restores and undoes through canonical store', () => {
  const storage = createMemoryStorage();
  let room = { schemaVersion: 6, roomName: '現在', participants: {}, participantTombstones: {}, allocations: {}, settlement: {}, overview: {}, meta: {}, resetGeneration: 0 };
  const commands = [];
  const store = { getSnapshot: () => room, command(name, args) { commands.push([name, structuredClone(args.value)]); room = structuredClone(args.value); } };
  const a = createHistoryService({ storage, roomId: 'A', clock: { now: () => 10 } });
  const b = createHistoryService({ storage, roomId: 'B', clock: { now: () => 20 } });
  a.save({ ...room, roomName: '保存A' });
  b.save({ ...room, roomName: '保存B' });
  assert.deepEqual(a.read().map(item => [item.time, item.data.roomName]), [[10, '保存A']]);
  assert.deepEqual(b.read().map(item => item.data.roomName), ['保存B']);
  a.restore(store, a.read()[0]);
  assert.equal(room.roomName, '保存A');
  assert.equal(a.undo(store), true);
  assert.equal(room.roomName, '現在');
  assert.deepEqual(commands.map(([name]) => name), ['restore', 'restore']);
});

test('guidance and handoff CSV preserve application metadata ownership and participant identity', () => {
  const room = {
    roomName: '紅葉',
    participants: { p1: participant('山田 花子', 2), p2: participant('手動 太郎', 1) },
    meta: { applicationSync: { kind: 'formApplicationSync', version: 2, title: '紅葉', eventDate: '2026-10-04', responseCount: 2, applicants: { r1: { name: '山田 花子', grade: 2, canDrive: true } } } },
  };
  const project = createProjectDomain({ getRoom: () => room, getAnnouncement: () => ({ meetingTime: '08:30', itinerary: [{ time: '09:00', step: '出発' }] }), settlement: createDomain().settlement });
  assert.match(project.bodyText(), /10月4日\(日\)紅葉企画/);
  assert.match(project.bodyText(), /○山田 花子/);
  assert.deepEqual(project.committedExportSelection(), { responseKeys: ['r1'], manualNames: ['手動 太郎'], ambiguousNames: [] });
  assert.equal(project.buildParticipantCsv([{ studentId: '123', name: '山田 "花子"' }]), '\uFEFF"学籍番号","氏名"\r\n"123","山田 ""花子"""\r\n');
  assert.equal(room.meta.applicationSync.title, '紅葉');
});
