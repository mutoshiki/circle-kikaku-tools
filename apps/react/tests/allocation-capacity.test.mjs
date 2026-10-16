import test from 'node:test';
import assert from 'node:assert/strict';
import { getCapacitySummary, toStoredCapacity } from '../src/components/allocation-capacity.js';

test('capacity summaries count the structural owner once for cars and teams', () => {
  assert.deepEqual(getCapacitySummary('car', 3, 3), { occupied: 4, totalCapacity: 4, remaining: 0 });
  assert.deepEqual(getCapacitySummary('team', 5, 3), { occupied: 4, totalCapacity: 5, remaining: 1 });
  assert.deepEqual(getCapacitySummary('team', 1, 0), { occupied: 1, totalCapacity: 1, remaining: 0 });
});

test('capacity input converts to the existing persistence contract', () => {
  assert.equal(toStoredCapacity('car', 4), 3);
  assert.equal(toStoredCapacity('team', 6), 6);
});
