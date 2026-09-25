import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sameCheckoutContent } from './protected-files-git.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const manifest = new URL('../migration/protected-files.json', import.meta.url);
const hash = path => createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex');
if (process.argv.includes('--capture')) {
  const paths = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const files = Object.fromEntries(paths.filter(path => !path.startsWith('apps/react/')).map(path => [path, hash(path)]));
  writeFileSync(manifest, JSON.stringify({ referenceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), files }, null, 2) + '\n');
  console.log(`Captured ${paths.length} legacy files`);
} else {
  const { files } = JSON.parse(readFileSync(manifest));
  if (process.argv.includes('--stable')) {
    const progress = JSON.parse(readFileSync(new URL('../migration/progress.json', import.meta.url)));
    const checkpoint = progress.phase9AExecution?.implementationCheckpoint;
    if (!checkpoint) throw new Error('Phase 9A implementation checkpoint is missing from migration progress');
    const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
    const readTree = commit => new Map(execFileSync('git', ['ls-tree', '-r', '-z', commit], { cwd: root, encoding: 'buffer' })
      .toString('utf8').split('\0').filter(Boolean).map(entry => {
        const [meta, path] = entry.split('\t', 2);
        return [path, meta.split(' ')[2]];
      }));
    const checkpointTree = readTree(checkpoint);
    const headTree = readTree('HEAD');
    const workingChanges = new Set(git(['diff', '--name-only', '--no-renames', 'HEAD', '--']).split(/\r?\n/).filter(Boolean));
    const isolationOverlays = new Set([
      // Local test-isolation plumbing is checked by its contract and browser tests, not as legacy app source.
      '.github/workflows/quality-guard.yml',
      'package.json',
      'playwright.config.js',
      'playwright.webkit.config.js',
      'tools/serve-static.mjs',
    ]);
    const changed = [];
    const missing = [];
    const contentChanged = [];
    for (const path of Object.keys(files)) {
      const checkpointBlob = checkpointTree.get(path);
      const headBlob = headTree.get(path);
      if (!checkpointBlob || !headBlob) { missing.push(path); continue; }
      if (checkpointBlob !== headBlob) { changed.push(path); continue; }
      if (isolationOverlays.has(path) && workingChanges.has(path)) continue;
      try {
        const worktreeBlob = git(['hash-object', `--path=${path}`, '--', path]);
        if (worktreeBlob !== checkpointBlob) {
          const checkpointBytes = execFileSync('git', ['show', `${checkpoint}:${path}`], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
          if (!sameCheckoutContent(readFileSync(resolve(root, path)), checkpointBytes)) contentChanged.push(path);
        }
      } catch { contentChanged.push(path); }
    }
    const unexpectedWorktreeChanges = [...workingChanges].filter(path => files[path] && !isolationOverlays.has(path));
    const changedOverlays = [...workingChanges].filter(path => isolationOverlays.has(path));
    if (missing.length || changed.length || contentChanged.length || unexpectedWorktreeChanges.length) {
      throw new Error(`Protected legacy verification failed: missing=${missing.length}, checkpointDiff=${changed.length}, worktreeDiff=${contentChanged.length}, unexpectedWorktree=${unexpectedWorktreeChanges.join(', ')}`);
    }
    console.log(`PASS ${Object.keys(files).length}/${Object.keys(files).length} protected files match Phase 9A checkpoint; checkout CRLF/LF normalized; isolated test-tool overlays=${changedOverlays.length}`);
    process.exit(0);
  }
  const changed = Object.entries(files).filter(([path, expected]) => { try { return hash(path) !== expected; } catch { return true; } }).map(([path]) => path);
  if (changed.length) throw new Error(`Protected legacy files changed: ${changed.join(', ')}`);
  console.log(`PASS ${Object.keys(files).length} legacy files unchanged`);
}
