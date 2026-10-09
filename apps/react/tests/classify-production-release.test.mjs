import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { classifyReleaseChanges, compareCommits } from '../tools/classify-production-release.mjs';

const previousSuccessSha = 'a'.repeat(40);
const targetSha = 'b'.repeat(40);

test('verified UI components, styles, public assets and focused browser specs use the standard route', () => {
  const result = classifyReleaseChanges({
    previousSuccessSha,
    targetSha,
    isAncestor: true,
    changedPaths: [
      'apps/react/src/components/Settlement.jsx',
      'apps/react/src/styles.scss',
      'apps/react/public/brand/mark.svg',
      'apps/react/tests/browser/settlement.spec.js',
    ],
  });
  assert.equal(result.mode, 'standard');
  assert.equal(result.reason, 'verified-ui-only-change');
});

test('a shared or configuration change anywhere since the last successful release uses migration', () => {
  const result = classifyReleaseChanges({
    previousSuccessSha,
    targetSha,
    isAncestor: true,
    changedPaths: [
      'apps/react/src/components/Participants.jsx',
      'apps/react/src/store/room-store.js',
    ],
  });
  assert.equal(result.mode, 'migration');
  assert.deepEqual(result.nonUiPaths, ['apps/react/src/store/room-store.js']);
});

test('release workflow, dependencies, production smoke, and unknown paths use migration', () => {
  for (const changedPath of [
    '.github/workflows/react-production-release.yml',
    'apps/react/package-lock.json',
    'apps/react/public/runtime-config.json',
    'apps/react/tests/browser/production-smoke.spec.js',
    'apps/react/src/unknown/feature.js',
  ]) {
    assert.equal(classifyReleaseChanges({
      previousSuccessSha,
      targetSha,
      isAncestor: true,
      changedPaths: [changedPath],
    }).mode, 'migration', changedPath);
  }
});

test('missing baseline, incomplete history and test-only commits use migration', () => {
  assert.equal(classifyReleaseChanges({ targetSha, changedPaths: ['apps/react/src/styles.scss'], isAncestor: false }).reason,
    'no-verified-previous-production-sha');
  assert.equal(classifyReleaseChanges({ previousSuccessSha, targetSha, changedPaths: [], isAncestor: false }).reason,
    'previous-production-sha-is-not-an-ancestor');
  assert.equal(classifyReleaseChanges({
    previousSuccessSha,
    targetSha,
    isAncestor: true,
    changedPaths: ['apps/react/tests/browser/settlement.spec.js'],
  }).reason, 'tests-only-change');
});

test('every path since previous production success is considered, including earlier shared commits', () => {
  const changedPaths = [
    'apps/react/src/components/Settlement.jsx',
    'firebase/database.rules.json',
  ];
  const result = classifyReleaseChanges({ previousSuccessSha, targetSha, isAncestor: true, changedPaths });
  assert.equal(result.mode, 'migration');
  assert.deepEqual(result.changedPaths, [...changedPaths].sort());
});

test('git range includes shared changes from earlier commits, not just the latest UI commit', () => {
  const repository = mkdtempSync(path.join(tmpdir(), 'release-classifier-'));
  const runGit = (...args) => execFileSync('git', args, { cwd: repository, encoding: 'utf8' }).trim();
  try {
    runGit('init', '--initial-branch=main');
    runGit('config', 'user.name', 'Release classifier test');
    runGit('config', 'user.email', 'release-classifier@example.invalid');
    mkdirSync(path.join(repository, 'apps/react/src/store'), { recursive: true });
    writeFileSync(path.join(repository, 'apps/react/src/store/room-store.js'), 'export const value = 1;');
    runGit('add', '.');
    runGit('commit', '-m', 'previous production release');
    const previous = runGit('rev-parse', 'HEAD');
    writeFileSync(path.join(repository, 'apps/react/src/store/room-store.js'), 'export const value = 2;');
    runGit('add', '.');
    runGit('commit', '-m', 'shared change');
    mkdirSync(path.join(repository, 'apps/react/src/components'), { recursive: true });
    writeFileSync(path.join(repository, 'apps/react/src/components/Participants.jsx'), 'export default 1;');
    runGit('add', '.');
    runGit('commit', '-m', 'ui change');
    const target = runGit('rev-parse', 'HEAD');
    const comparison = compareCommits(previous, target, repository);
    const result = classifyReleaseChanges({ previousSuccessSha: previous, targetSha: target, ...comparison });
    assert.equal(result.mode, 'migration');
    assert.deepEqual(result.nonUiPaths, ['apps/react/src/store/room-store.js']);

    const outputFile = path.join(repository, 'github-output.txt');
    const cliOutput = execFileSync(process.execPath, [
      fileURLToPath(new URL('../tools/classify-production-release.mjs', import.meta.url)), previous, target,
    ], { cwd: repository, env: { ...process.env, GITHUB_OUTPUT: outputFile }, encoding: 'utf8' });
    const cliResult = JSON.parse(cliOutput);
    const githubOutputs = Object.fromEntries(readFileSync(outputFile, 'utf8')
      .trim().split('\n').map(line => line.split(/=(.*)/s).slice(0, 2)));
    assert.equal(githubOutputs.mode, cliResult.mode);
    assert.equal(githubOutputs.reason, cliResult.reason);
    assert.deepEqual(JSON.parse(githubOutputs.changed_paths_json), cliResult.changedPaths);
  } finally {
    rmSync(repository, { recursive: true, force: true });
  }
});
