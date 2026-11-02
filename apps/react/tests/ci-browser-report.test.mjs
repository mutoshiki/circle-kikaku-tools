import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('../../..', import.meta.url));
const checker = join(repository, 'tools/assert-browser-clean.mjs');

function run(report) {
  const directory = mkdtempSync(join(tmpdir(), 'browser-report-'));
  const path = join(directory, 'report.json');
  try {
    writeFileSync(path, JSON.stringify(report));
    return spawnSync(process.execPath, [checker, path, '--projects=chromium-desktop,chromium-mobile'], {
      encoding: 'utf8',
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const passed = projectName => ({
  title: 'works', file: 'tests/browser/sample.spec.js', tests: [{
    projectName, outcome: 'expected', results: [{ status: 'passed' }],
  }],
});

test('accepts the selected projects and reports explicit skips separately', () => {
  const report = {
    stats: { expected: 2, skipped: 1, unexpected: 0, flaky: 0 },
    suites: [{ title: 'sample.spec.js', specs: [
      passed('chromium-desktop'),
      passed('chromium-mobile'),
      { title: 'known skip', file: 'tests/browser/sample.spec.js', tests: [{
        projectName: 'chromium-mobile', outcome: 'skipped', results: [{ status: 'skipped' }],
      }] },
    ] }],
  };
  const result = run(report);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /passed=2 skipped=1/);
});

test('rejects an empty or fully skipped report', () => {
  for (const report of [
    { stats: { expected: 0, skipped: 0, unexpected: 0, flaky: 0 }, suites: [] },
    { stats: { expected: 2, skipped: 2, unexpected: 0, flaky: 0 }, suites: [{
      title: 'sample.spec.js', specs: [{ title: 'skipped', file: 'tests/browser/sample.spec.js', tests: [{
        projectName: 'chromium-desktop', outcome: 'skipped', results: [{ status: 'skipped' }],
      }] }],
    }] },
  ]) assert.notEqual(run(report).status, 0);
});

test('rejects a missing required project', () => {
  const result = run({
    stats: { expected: 1, skipped: 0, unexpected: 0, flaky: 0 },
    suites: [{ title: 'sample.spec.js', specs: [passed('chromium-desktop')] }],
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /chromium-mobile/);
});

test('rejects a report whose statistics say selected tests are missing', () => {
  const result = run({
    stats: { expected: 3, skipped: 0, unexpected: 0, flaky: 0 },
    suites: [{ title: 'sample.spec.js', specs: [passed('chromium-desktop'), passed('chromium-mobile')] }],
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /result counts do not match the report statistics/);
});

test('rejects unexpected and flaky outcomes even if the run report exists', () => {
  for (const outcome of ['unexpected', 'flaky']) {
    const result = run({
      stats: { expected: 2, skipped: 0, unexpected: outcome === 'unexpected' ? 1 : 0, flaky: outcome === 'flaky' ? 1 : 0 },
      suites: [{ title: 'sample.spec.js', specs: [
        passed('chromium-desktop'),
        { title: 'bad', file: 'tests/browser/sample.spec.js', tests: [{
          projectName: 'chromium-mobile', outcome, results: [{ status: outcome === 'flaky' ? 'passed' : 'failed' }],
        }] },
      ] }],
    });
    assert.notEqual(result.status, 0);
  }
});
