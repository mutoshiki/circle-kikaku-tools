import test from 'node:test';
import assert from 'node:assert/strict';
import { DISTANCE_GUIDE_PREFERENCE_KEY, readDistanceGuideHidden, writeDistanceGuideHidden } from '../src/services/distance-guide-preference.js';

test('distance guide preference is saved only as a browser-local boolean', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };

  assert.equal(readDistanceGuideHidden(storage), false);
  writeDistanceGuideHidden(storage, true);
  assert.equal(values.get(DISTANCE_GUIDE_PREFERENCE_KEY), 'true');
  assert.equal(readDistanceGuideHidden(storage), true);
  writeDistanceGuideHidden(storage, false);
  assert.equal(readDistanceGuideHidden(storage), false);
});

test('unavailable storage falls back to showing the guide', () => {
  const storage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  assert.equal(readDistanceGuideHidden(storage), false);
  assert.equal(writeDistanceGuideHidden(storage, true), false);
});
