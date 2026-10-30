import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveEntryScreen, creationIntentKey, readCreationIntent } from '../src/services/project-entry.js';

test('root and create routes are selected before room creation while legacy room links keep priority', () => {
  assert.equal(resolveEntryScreen('https://example.test/circle-kikaku-tools/'), 'list');
  assert.equal(resolveEntryScreen('https://example.test/circle-kikaku-tools/?screen=create'), 'create');
  assert.equal(resolveEntryScreen('https://example.test/circle-kikaku-tools/?room=ABC12345&screen=create'), null);
  assert.equal(resolveEntryScreen('https://example.test/circle-kikaku-tools/?legacy=1'), null);
});

test('creation recovery key is scoped to the exact room id', () => {
  assert.equal(creationIntentKey('ROOM_1234'), 'sanpo-project-create:v1:ROOM_1234');
});

test('creation intent is restored only for the matching room and malformed storage remains recoverable', () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, removeItem: key => data.delete(key) };
  data.set(creationIntentKey('ROOM1234'), JSON.stringify({ roomId: 'ROOM1234', roomName: 'Test', workspace: { schemaVersion: 1 } }));
  assert.equal(readCreationIntent(storage, 'OTHER123'), null);
  assert.equal(readCreationIntent(storage, 'ROOM1234').roomName, 'Test');
  data.set(creationIntentKey('BROKEN12'), '{');
  assert.equal(readCreationIntent(storage, 'BROKEN12'), null);
  assert.notEqual(storage.getItem(creationIntentKey('BROKEN12')), null);
});
