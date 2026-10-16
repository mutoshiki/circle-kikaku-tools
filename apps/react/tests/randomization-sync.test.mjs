import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeRandomizationHistory, withRandomizationSync } from '../src/domain/randomization-sync.js';
import { fixture } from './reference.mjs';
import { getRandomizationConditionsKey, createRandomizationHistory } from '../src/domain/randomization-history.js';
import { createRoomStore } from '../src/store/room-store.js';

const room = createRoomStore({ initial: fixture }).getSnapshot();
const key = getRandomizationConditionsKey(room, 'car');
const history = (ids, epochId = 'epoch-a') => ({ ...createRandomizationHistory(key, epochId), conditionsKey: key, runs: Object.fromEntries(ids.map(id => [id, true])) });

test('concurrent same-epoch runs merge as a set and duplicate delivery counts once', () => {
  const base = structuredClone(room);
  base.allocations.car.randomization = history(['run-1']);
  const remote = structuredClone(base);
  remote.allocations.car.randomization.runs['run-2'] = true;
  const local = structuredClone(base);
  local.allocations.car.randomization.runs['run-3'] = true;
  const next = structuredClone(remote);
  const intent = { type: 'car', epochId: 'epoch-a', conditionsKey: key, runIds: ['run-3'] };
  const merged = mergeRandomizationHistory({ remote, base, local, next, intent });
  assert.equal(Object.keys(merged.allocations.car.randomization.runs).length, 3);
  assert.equal(mergeRandomizationHistory({ remote: merged, base, local, next: merged, intent }).allocations.car.randomization.runs['run-3'], true);
});

test('history merge rejects an intent after assignment conditions changed remotely', () => {
  const remote = structuredClone(room);
  remote.allocations.car.groups[Object.keys(remote.allocations.car.groups)[0]].capacity += 1;
  const local = structuredClone(room);
  local.allocations.car.randomization = history(['late-run']);
  assert.throws(() => mergeRandomizationHistory({ remote, base: room, local, next: remote, intent: { type: 'car', epochId: 'epoch-a', conditionsKey: key, runIds: ['late-run'] } }), error => error.code === 'randomization/conditions-changed');
});

test('sync wrapper diffs and applies allocation randomization history without changing generated contract', () => {
  const base = structuredClone(room);
  const local = structuredClone(base);
  local.allocations.car.randomization = history(['one']);
  const generated = {
    buildEntityPatch: () => ({}),
    applyVersionedEntityPatch: () => structuredClone(local),
  };
  const sync = withRandomizationSync(generated);
  assert.deepEqual(sync.buildEntityPatch(base, local), { 'allocations/car/randomization': local.allocations.car.randomization });
  assert.deepEqual(sync.applyVersionedEntityPatch(base, base, local, {}, 1, 'op', 100, { randomizationIntents: [{ type: 'car', epochId: 'epoch-a', conditionsKey: key, runIds: ['one'] }] }), local);
});
