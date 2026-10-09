#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const shaPattern = /^[a-f0-9]{40}$/;

function isUiPath(filePath) {
  const path = filePath.replaceAll('\\', '/');
  if (path === 'apps/react/src/styles.scss') return true;
  if (/^apps\/react\/src\/components\/.+\.(?:jsx|tsx|css|scss)$/.test(path)) return true;
  if (/^apps\/react\/public\/.+\.(?:avif|gif|ico|jpe?g|png|svg|webp|woff2?|ttf|otf|css)$/.test(path)) return true;
  if (/^apps\/react\/tests\/browser\/(?!production-smoke\.spec\.js$).+\.spec\.js$/.test(path)) return true;
  if (path === 'apps/react/tests/browser/settlement-smoke-actions.mjs') return true;
  return false;
}

export function classifyReleaseChanges({ previousSuccessSha, targetSha, changedPaths, isAncestor }) {
  const paths = [...new Set((changedPaths || []).map(filePath => String(filePath).replaceAll('\\', '/')))].sort();
  if (!shaPattern.test(previousSuccessSha || '')) {
    return { mode: 'migration', reason: 'no-verified-previous-production-sha', changedPaths: paths };
  }
  if (!shaPattern.test(targetSha || '') || !isAncestor) {
    return { mode: 'migration', reason: 'previous-production-sha-is-not-an-ancestor', changedPaths: paths };
  }
  if (paths.length === 0) return { mode: 'migration', reason: 'no-changed-paths-to-classify', changedPaths: paths };
  const nonUiPaths = paths.filter(filePath => !isUiPath(filePath));
  if (nonUiPaths.length) return { mode: 'migration', reason: 'non-ui-or-unknown-paths', changedPaths: paths, nonUiPaths };
  const appPaths = paths.filter(filePath => !filePath.startsWith('apps/react/tests/browser/'));
  if (!appPaths.length) return { mode: 'migration', reason: 'tests-only-change', changedPaths: paths };
  return { mode: 'standard', reason: 'verified-ui-only-change', changedPaths: paths };
}

export function compareCommits(previousSuccessSha, targetSha, cwd = process.cwd()) {
  if (!shaPattern.test(previousSuccessSha || '') || !shaPattern.test(targetSha || '')) {
    return { isAncestor: false, changedPaths: [] };
  }
  try {
    execFileSync('git', ['cat-file', '-e', `${previousSuccessSha}^{commit}`], { cwd, stdio: 'ignore' });
    execFileSync('git', ['cat-file', '-e', `${targetSha}^{commit}`], { cwd, stdio: 'ignore' });
  } catch {
    return { isAncestor: false, changedPaths: [] };
  }
  let isAncestor = true;
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', previousSuccessSha, targetSha], { cwd, stdio: 'ignore' });
  } catch {
    isAncestor = false;
  }
  if (!isAncestor) return { isAncestor, changedPaths: [] };
  const diff = execFileSync('git', ['diff', '--name-only', '-z', '--no-renames', previousSuccessSha, targetSha], { cwd, encoding: 'utf8' });
  return { isAncestor, changedPaths: diff.split('\0').filter(Boolean) };
}

function writeGithubOutput(result) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  const previousSha = process.argv[2] || '';
  appendFileSync(outputPath,
    `mode=${result.mode}\nreason=${result.reason}\nprevious_success_sha=${shaPattern.test(previousSha) ? previousSha : ''}\nchanged_paths_json=${JSON.stringify(result.changedPaths)}\n`);
}

if (process.argv[1] && process.argv[1].endsWith('classify-production-release.mjs')) {
  try {
    const previousSuccessSha = process.argv[2] || '';
    const targetSha = process.argv[3] || '';
    const comparison = compareCommits(previousSuccessSha, targetSha);
    const result = classifyReleaseChanges({ previousSuccessSha, targetSha, ...comparison });
    writeGithubOutput(result);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
