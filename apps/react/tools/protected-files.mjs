import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  const changed = Object.entries(files).filter(([path, expected]) => { try { return hash(path) !== expected; } catch { return true; } }).map(([path]) => path);
  if (changed.length) throw new Error(`Protected legacy files changed: ${changed.join(', ')}`);
  console.log(`PASS ${Object.keys(files).length} legacy files unchanged`);
}
