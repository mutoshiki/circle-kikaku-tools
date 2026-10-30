import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { recordPortalVisit, updatePortalProject, readPortalProjects, PORTAL_HISTORY_KEY } from '../src/services/portal-history.js';
import { createLocalRuntime } from '../src/runtime.js';

function memoryStorage() {
  const data = new Map();
  let writes = 0;
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => { writes += 1; data.set(key, String(value)); }, key: index => [...data.keys()][index] ?? null, get length() { return data.size; }, data, get writes() { return writes; } };
}

test('project list recovers rooms from the existing portal index, React cache, opened keys and last-room key', () => {
  const storage = memoryStorage();
  storage.setItem(PORTAL_HISTORY_KEY, JSON.stringify({ version: 1, projects: [{ roomId: 'ABC12345', name: 'Index name', lastOpenedAt: 100 }] }));
  storage.setItem('sanpo-react:v1:REACT123:room', JSON.stringify({ roomName: 'Cached room', lastUpdatedAt: 300 }));
  storage.setItem('syawari_last_opened_at_OPEN123', '200');
  storage.setItem('syawari_last_room_id', 'LAST1234');
  const result = readPortalProjects(storage);
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.projects.map(project => project.roomId), ['REACT123', 'OPEN123', 'ABC12345', 'LAST1234']);
  assert.equal(result.projects[0].name, 'Cached room');
  assert.equal(result.projects[0].updatedAt, 300);
});

test('project list distinguishes empty storage from corrupted or inaccessible storage', () => {
  const empty = memoryStorage();
  assert.equal(readPortalProjects(empty).status, 'empty');
  const broken = memoryStorage();
  broken.setItem(PORTAL_HISTORY_KEY, '{');
  assert.equal(readPortalProjects(broken).status, 'unavailable');
  const inaccessible = { get length() { throw new Error('denied'); }, getItem() { throw new Error('denied'); } };
  assert.equal(readPortalProjects(inaccessible).status, 'unavailable');
});

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
