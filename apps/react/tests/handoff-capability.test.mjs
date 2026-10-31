import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandoffCapability } from '../src/services/handoff-capability.js';

const token = `h_${'a'.repeat(64)}`;

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    read(key) { return values.get(key) ?? null; },
    write(key, value) { values.set(key, value); },
    remove(key) { values.delete(key); },
  };
}

test('handoff capability only accepts the current room and expected job, then notifies subscribers', () => {
  const storage = memoryStorage();
  const capability = createHandoffCapability({ roomId: 'ROOM-A', storage });
  let updates = 0;
  capability.subscribe(() => updates++);

  assert.equal(capability.accept({ roomId: 'ROOM-B', jobId: 'job-1', token }, 'job-1'), false);
  assert.equal(capability.accept({ roomId: 'ROOM-A', jobId: 'job-2', token }, 'job-1'), false);
  assert.equal(capability.accept({ roomId: 'ROOM-A', jobId: 'job-1', token: 'invalid' }, 'job-1'), false);
  assert.equal(capability.getSnapshot().token, '');

  assert.equal(capability.accept({ roomId: 'ROOM-A', jobId: 'job-1', token }, 'job-1'), true);
  assert.equal(capability.getSnapshot().token, token);
  assert.equal(updates, 1);
  assert.deepEqual(storage.read('handoffCapability'), { roomId: 'ROOM-A', jobId: 'job-1', token });
});

test('handoff capability restores only a token for the current room and expected job', () => {
  const storage = memoryStorage({
    handoffCapability: { roomId: 'ROOM-A', jobId: 'job-1', token },
  });
  const valid = createHandoffCapability({ roomId: 'ROOM-A', initialJobId: 'job-1', storage });
  const wrongJob = createHandoffCapability({ roomId: 'ROOM-A', initialJobId: 'job-2', storage });
  const wrongRoom = createHandoffCapability({ roomId: 'ROOM-B', initialJobId: 'job-1', storage });
  assert.equal(valid.getSnapshot().token, token);
  assert.equal(wrongJob.getSnapshot().token, '');
  assert.equal(wrongRoom.getSnapshot().token, '');
});
