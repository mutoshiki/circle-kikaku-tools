import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationPeople } from '../src/ui/participant-registration.js';
import { createParticipantTaskDraft } from '../src/ui/participant-task-draft.js';

test('manual registration preserves driver-only, grade-only and normalized duplicate capabilities', () => {
  const result = registrationPeople({ source: 'manual', members: '山田 太郎\n山田太郎\n佐藤', drivers: '山田太郎\n運転手のみ', grades: ['学年のみ', '佐藤', '', ''] });
  assert.deepEqual(result.people, [
    { name: '山田 太郎', grade: 0, driver: true },
    { name: '佐藤', grade: 2, driver: false },
    { name: '運転手のみ', grade: 0, driver: true },
    { name: '学年のみ', grade: 1, driver: false },
  ]);
});

test('paste corrections keep parser warnings and reject blank corrected names before registration', () => {
  const input = { source: 'paste', sheet: '名前\t学年\t車出し\n佐藤\t不明\tいいえ', corrections: { 0: { name: '修正', grade: 3, driver: true } } };
  const result = registrationPeople(input);
  assert.deepEqual(result.people.map(p => [p.name, p.grade, p.driver]), [['修正', 3, true]]);
  assert.ok(result.warnings.length);
  assert.equal(registrationPeople({ ...input, corrections: { 0: { name: '' } } }).invalidIndex, 0);
  assert.equal(registrationPeople({ source: 'paste', sheet: '見出しなし' }).ok, false);
});

test('task drafts recover only the matching room/task and retain memory when storage fails', () => {
  const map = new Map();
  const storage = { getItem: key => map.get(key) || null, setItem: (key, val) => map.set(key, val), removeItem: key => map.delete(key) };
  const options = { storage: () => storage, roomId: 'draft-A', task: 'import' };
  const first = createParticipantTaskDraft(options);
  assert.equal(first.write({ members: '未登録' }), true);
  assert.deepEqual(createParticipantTaskDraft(options).read(), { members: '未登録' });
  assert.equal(createParticipantTaskDraft({ ...options, roomId: 'draft-B' }).read(), null);
  assert.equal(createParticipantTaskDraft({ ...options, task: 'announcement' }).read(), null);
  const broken = createParticipantTaskDraft({ ...options, storage: () => { throw new Error('blocked'); } });
  assert.equal(broken.write({ members: '保持' }), false);
  assert.deepEqual(broken.read(), { members: '保持' });
  first.clear();
  assert.equal(first.read(), null);
});

test('quota failure retains the newest draft across task remount even when older storage is readable', () => {
  const map = new Map();
  let quota = false;
  const storage = { getItem: key => map.get(key) || null, setItem(key, value) { if (quota) throw new Error('quota'); map.set(key, value); }, removeItem: key => map.delete(key) };
  const options = { storage: () => storage, roomId: 'quota-room', task: 'import' };
  const cache = createParticipantTaskDraft(options);
  cache.write({ members: 'old' });
  quota = true;
  assert.equal(cache.write({ members: 'newest' }), false);
  assert.deepEqual(createParticipantTaskDraft(options).read(), { members: 'newest' });
  assert.equal(createParticipantTaskDraft(options).isRecoverable(), false);
  quota = false;
  cache.clear();
});
