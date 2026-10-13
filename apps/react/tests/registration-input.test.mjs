import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseManualNames, buildManualPeople, summarizePeople } from '../src/components/registration-input.js';

test('manual names are trimmed, blank lines removed and normalized duplicates kept once in first-seen order', () => {
  assert.deepEqual(parseManualNames(' 参加者A \r\n\r\n参加者B\n参 加者B '), [
    { key: '参加者A', name: '参加者A' },
    { key: '参加者B', name: '参加者B' },
  ]);
});

test('manual attributes stay attached to a person when names are reordered and removed names are not submitted', () => {
  const draft = { '参加者A': { grade: 1, driver: false }, '参加者B': { grade: 3, driver: true } };
  const reordered = parseManualNames('参加者B\n参加者A');
  assert.deepEqual(buildManualPeople(reordered, draft), [
    { name: '参加者B', grade: 3, driver: true },
    { name: '参加者A', grade: 1, driver: false },
  ]);
  assert.deepEqual(buildManualPeople(parseManualNames('参加者A'), draft), [
    { name: '参加者A', grade: 1, driver: false },
  ]);
});

test('manual attributes default to no grade and no driver, and the summary uses deduplicated people', () => {
  const people = buildManualPeople(parseManualNames('参加者A\n参加者A\n参加者B'), {});
  assert.deepEqual(people, [
    { name: '参加者A', grade: 0, driver: false },
    { name: '参加者B', grade: 0, driver: false },
  ]);
  assert.deepEqual(summarizePeople(people), { total: 2, drivers: 0, unknownGrades: 2 });
  assert.deepEqual(summarizePeople([]), { total: 0, drivers: 0, unknownGrades: 0 });
});
