import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { recordPortalVisit, updatePortalProject } from '../src/services/portal-history.js';
import { createLocalRuntime } from '../src/runtime.js';

function memoryStorage() {
  const data = new Map();
  let writes = 0;
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => { writes += 1; data.set(key, String(value)); }, data, get writes() { return writes; } };
}

test('records current project visit and compatibility keys', () => {
  const storage = memoryStorage();
  assert.equal(recordPortalVisit(storage, { roomId: 'A', name: '山行' }, 1234).ok, true);
  assert.equal(JSON.parse(storage.getItem('sanpokai_portal_project_history_v1')).projects[0].lastOpenedAt, 1234);
  assert.equal(storage.getItem('syawari_last_room_id'), 'A');
  assert.equal(storage.getItem('syawari_last_opened_at_A'), '1234');
});

test('updates the name without changing last visit and retains other rooms', () => {
  const storage = memoryStorage();
  recordPortalVisit(storage, { roomId: 'A', name: 'old' }, 1234);
  recordPortalVisit(storage, { roomId: 'B', name: 'other' }, 2345);
  updatePortalProject(storage, { roomId: 'A', name: 'new', updatedAt: 9999 });
  const projects = JSON.parse(storage.getItem('sanpokai_portal_project_history_v1')).projects;
  assert.equal(projects.find(project => project.roomId === 'A').name, 'new');
  assert.equal(projects.find(project => project.roomId === 'A').lastOpenedAt, 1234);
  assert.equal(projects.length, 2);
});

test('storage failure does not throw into project startup', () => {
  const denied = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.equal(recordPortalVisit(denied, { roomId: 'A', name: 'x' }, 1).ok, false);
});

test('updating unchanged project metadata does not write the index again', () => {
  const storage = memoryStorage();
  recordPortalVisit(storage, { roomId: 'A', name: '山行', updatedAt: 123 }, 456);
  updatePortalProject(storage, { roomId: 'A', name: '山行', updatedAt: 123 });
  const writes = storage.writes;
  updatePortalProject(storage, { roomId: 'A', name: '山行', updatedAt: 123 });
  assert.equal(storage.writes, writes);
});

test('runtime start records a visit and room changes update the registry without changing visit time', async () => {
  const storage = memoryStorage();
  const location = { href: 'https://mutoshiki.github.io/circle-kikaku-tools/?room=RUNTIME-ROOM' };
  const history = { state: null, replaceState(_state, _title, href) { location.href = href; } };
  const runtime = createLocalRuntime({ location, history, storage, crypto: webcrypto });
  runtime.start();
  const first = JSON.parse(storage.getItem('sanpokai_portal_project_history_v1')).projects[0];
  assert.equal(first.roomId, 'RUNTIME-ROOM');
  assert.ok(first.lastOpenedAt > 0);
  runtime.store.command('rename', { name: '名称変更後' });
  const updated = JSON.parse(storage.getItem('sanpokai_portal_project_history_v1')).projects[0];
  assert.equal(updated.name, '名称変更後');
  assert.equal(updated.lastOpenedAt, first.lastOpenedAt);
  await runtime.dispose();
});
