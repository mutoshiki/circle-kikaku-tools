import test from 'node:test';
import assert from 'node:assert/strict';
import { clearSettlementCarCheckpoint, readSettlementCarCheckpoint, writeSettlementCarCheckpoint } from '../src/services/settlement-car-checkpoint.js';

function memoryStorage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}

test('checkpoint is scoped to its room and cleared after save or cancel', () => {
  const storage = memoryStorage();
  const checkpoint = { roomId: 'ROOM-1', carName: 'A', baseCar: { dist: '10' }, draftCar: { dist: '20' }, resetGeneration: 1, now: 100 };
  assert.equal(writeSettlementCarCheckpoint(storage, checkpoint), true);
  assert.equal(readSettlementCarCheckpoint(storage, 'ROOM-2', 101), null);
  const { now, ...stored } = checkpoint;
  assert.deepEqual(readSettlementCarCheckpoint(storage, 'ROOM-1', 101), { ...stored, expiresAt: 100 + 30 * 60 * 1000 });
  clearSettlementCarCheckpoint(storage, 'ROOM-1');
  assert.equal(readSettlementCarCheckpoint(storage, 'ROOM-1', 101), null);
});

test('expired or unavailable checkpoints are ignored', () => {
  const storage = memoryStorage();
  writeSettlementCarCheckpoint(storage, { roomId: 'ROOM-1', carName: 'A', baseCar: {}, draftCar: {}, resetGeneration: 0, now: 0 });
  assert.equal(readSettlementCarCheckpoint(storage, 'ROOM-1', 30 * 60 * 1000 + 1), null);
  const unavailable = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  assert.equal(writeSettlementCarCheckpoint(unavailable, { roomId: 'ROOM-1', carName: 'A', baseCar: {}, draftCar: {} }), false);
  assert.equal(readSettlementCarCheckpoint(unavailable, 'ROOM-1'), null);
});
