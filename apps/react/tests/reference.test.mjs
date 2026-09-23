import test from 'node:test';
import assert from 'node:assert/strict';
import { createReference, fixture, plain } from './reference.mjs';

test('baseline: migration, allocation projection, role, patch and settlement are reproducible', () => {
  const reference = createReference();
  const engine = reference.SanpoCanonicalState;
  const room = engine.migrate(fixture);
  assert.equal(room.schemaVersion, 6);
  assert.equal(Object.keys(room.participants).length, 6);
  const car = engine.projectAllocation(room, 'car');
  const team = engine.projectAllocation(room, 'team');
  assert.equal(car.cars.length, 2);
  assert.equal(team.waiting.length, 6);
  assert.equal(car.cars[0].driver, true);
  const state = reference.normalizeSettlementState(engine.settlementToUi(room.settlement, room.participants));
  const calculation = plain(reference.calculateSettlement(car, state));
  assert.equal(calculation.participants.length, 6);
  assert.equal(calculation.cars.length, 2);
  const next = structuredClone(room);
  next.participants[car.cars[0].participantId].memo = '変更';
  const patch = plain(reference.SanpoEntitySyncTest.buildEntityPatch(room, next));
  assert.ok(Object.keys(patch).some(path => /participants\/.+\/memo/.test(path)));
  assert.ok(!Object.keys(patch).some(path => path.startsWith('allocations/')));
  assert.ok(!Object.keys(patch).some(path => path.startsWith('meta')));
});
