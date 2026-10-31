#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const shaPattern = /^[a-f0-9]{40}$/;
const fingerprintPattern = /^[a-f0-9]{64}$/;
const thisDirectory = path.dirname(fileURLToPath(import.meta.url));
const reactRoot = path.resolve(thisDirectory, '..');
const repositoryRoot = execFileSync('git', ['-C', reactRoot, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const metadataName = 'preview-origin.json';

const hash = value => createHash('sha256').update(value).digest('hex');
const canonicalPath = value => path.resolve(value).replaceAll('\\', '/').replace(/\/$/, '').toLowerCase();

export function validatePreviewOrigin(metadata, current) {
  const reasons = [];
  if (!metadata || typeof metadata !== 'object') return { ok: false, reasons: ['preview metadata is missing or invalid'] };
  if (metadata.schemaVersion !== 1) reasons.push('preview metadata schema version is unsupported');
  if (!shaPattern.test(current?.expectedSourceSha || '')) reasons.push('expected baseline SHA is invalid');
  if (!shaPattern.test(metadata.baselineSourceSha || '') || metadata.baselineSourceSha !== current?.expectedSourceSha) {
    reasons.push('preview baseline SHA does not match the requested source');
  }
  if (!shaPattern.test(metadata.worktreeHead || '') || metadata.worktreeHead !== current?.worktreeHead) {
    reasons.push('preview worktree HEAD does not match the current source tree');
  }
  if (!metadata.sourceRoot || canonicalPath(metadata.sourceRoot) !== canonicalPath(current?.sourceRoot || '')) {
    reasons.push('preview was built from a different worktree');
  }
  if (!fingerprintPattern.test(metadata.sourceFingerprint || '')
    || metadata.sourceFingerprint !== current?.sourceFingerprint) {
    reasons.push('preview source fingerprint is stale or invalid');
  }
  if (typeof metadata.dirty !== 'boolean' || !Number.isFinite(Date.parse(metadata.builtAt || ''))) {
    reasons.push('preview build metadata is incomplete');
  }
  if (metadata.syncMode !== 'local') reasons.push('preview is not isolated from production data');
  if (!Array.isArray(metadata.assets) || !metadata.assets.some(asset => asset.path === 'index.html')) {
    reasons.push('preview asset inventory is missing');
  }
  return { ok: reasons.length === 0, reasons };
}

export function assertLocalPreviewEnvironment(environment) {
  const syncMode = environment?.VITE_REACT_SYNC_MODE || 'local';
  if (syncMode !== 'local') throw new Error('verified previews require local sync mode');
  if (environment?.VITE_REACT_FIREBASE_CONFIG) throw new Error('verified previews cannot include Firebase config');
  return syncMode;
}

function git(root, ...args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
}

async function sourceFingerprint(root) {
  const listed = execFileSync('git', ['-C', root, 'ls-files', '-co', '--exclude-standard', '-z']);
  const files = listed.toString('utf8').split('\0').filter(Boolean).sort();
  const digest = createHash('sha256');
  for (const relative of files) {
    const normalized = relative.split(path.sep).join('/');
    try {
      digest.update(normalized).update('\0').update(await readFile(path.join(root, relative))).update('\0');
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
  }
  return digest.digest('hex');
}

async function collectAssets(directory) {
  const entries = [];
  async function visit(folder, prefix = '') {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new Error(`preview output contains a symlink: ${relative}`);
      if (entry.isDirectory()) await visit(path.join(folder, entry.name), relative);
      else if (entry.isFile() && relative !== metadataName) {
        entries.push({ path: relative, sha256: hash(await readFile(path.join(folder, entry.name))) });
      }
    }
  }
  await visit(directory);
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

async function currentIdentity(root) {
  return {
    worktreeHead: git(root, 'rev-parse', 'HEAD'),
    sourceRoot: root,
    sourceFingerprint: await sourceFingerprint(root),
    dirty: Boolean(git(root, 'status', '--porcelain=v1', '--untracked-files=all')),
  };
}

async function build(baselineSourceSha) {
  if (!shaPattern.test(baselineSourceSha || '')) throw new Error('pass --baseline-source-sha with the published manifest sourceSha');
  const before = await currentIdentity(repositoryRoot);
  try {
    execFileSync('git', ['-C', repositoryRoot, 'merge-base', '--is-ancestor', baselineSourceSha, before.worktreeHead], { stdio: 'ignore' });
  } catch {
    throw new Error(`baseline ${baselineSourceSha} is not an ancestor of worktree HEAD ${before.worktreeHead}`);
  }
  const { loadEnv } = await import('vite');
  const syncMode = assertLocalPreviewEnvironment(loadEnv('production', reactRoot, 'VITE_'));
  const viteCli = path.join(reactRoot, 'node_modules', 'vite', 'bin', 'vite.js');
  execFileSync(process.execPath, [viteCli, 'build'], { cwd: reactRoot, stdio: 'inherit' });
  const after = await currentIdentity(repositoryRoot);
  if (before.worktreeHead !== after.worktreeHead || before.sourceFingerprint !== after.sourceFingerprint) {
    throw new Error('source changed while the preview was building; rerun after edits stop');
  }
  const dist = path.join(reactRoot, 'dist');
  const metadata = {
    schemaVersion: 1,
    baselineSourceSha,
    ...after,
    syncMode,
    builtAt: new Date().toISOString(),
    assets: await collectAssets(dist),
  };
  await writeFile(path.join(dist, metadataName), `${JSON.stringify(metadata, null, 2)}\n`);
  process.stdout.write(`Built local-only preview: baseline ${baselineSourceSha}, HEAD ${after.worktreeHead}, dirty=${after.dirty}.\n`);
}

async function fetchAsset(base, assetPath) {
  const response = await fetch(new URL(assetPath, base), { cache: 'no-store' });
  if (!response.ok) throw new Error(`preview did not serve ${assetPath} (HTTP ${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}

async function check(urlValue, expectedSourceSha) {
  if (!shaPattern.test(expectedSourceSha || '')) throw new Error('pass --expected-source-sha with the published manifest sourceSha');
  const base = new URL(urlValue);
  if (!['http:', 'https:'].includes(base.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) {
    throw new Error('preview check only accepts localhost URLs; it does not submit production data');
  }
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  const metadata = JSON.parse((await fetchAsset(base, metadataName)).toString('utf8'));
  const current = { expectedSourceSha, ...await currentIdentity(repositoryRoot) };
  const validation = validatePreviewOrigin(metadata, current);
  if (!validation.ok) throw new Error(validation.reasons.join('; '));

  const expectedAssets = await collectAssets(path.join(reactRoot, 'dist'));
  const expectedIndex = expectedAssets.find(asset => asset.path === 'index.html');
  const servedIndex = await fetchAsset(base, 'index.html');
  if (hash(servedIndex) !== expectedIndex?.sha256) throw new Error('served index.html differs from the checked worktree build');

  const indexText = servedIndex.toString('utf8');
  const referenced = [...indexText.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map(match => match[1])
    .filter(value => value.startsWith('./assets/') || value.startsWith('/assets/'))
    .map(value => value.replace(/^\.\//, ''));
  const expectedByPath = new Map(expectedAssets.map(asset => [asset.path, asset.sha256]));
  if (!referenced.length) throw new Error('served index.html has no local bundled assets to verify');
  for (const assetPath of referenced) {
    const expectedHash = expectedByPath.get(assetPath);
    if (!expectedHash) throw new Error(`served index references an asset outside the checked build: ${assetPath}`);
    if (hash(await fetchAsset(base, assetPath)) !== expectedHash) throw new Error(`served asset differs from the checked build: ${assetPath}`);
  }
  process.stdout.write(`Preview verified: ${base.href}\nbaseline=${metadata.baselineSourceSha}\nHEAD=${metadata.worktreeHead}\ndirty=${metadata.dirty}\nindex and ${referenced.length} bundled asset(s) match the worktree build.\n`);
}

function parseArgs(argv) {
  const [command, ...values] = argv;
  const options = {};
  for (let index = 0; index < values.length; index++) {
    if (values[index].startsWith('--')) options[values[index].slice(2)] = values[++index];
    else throw new Error(`unexpected argument: ${values[index]}`);
  }
  if (command === 'build') return { command, baselineSourceSha: options['baseline-source-sha'] };
  if (command === 'check') return { command, url: options.url, expectedSourceSha: options['expected-source-sha'] };
  throw new Error('usage: node tools/preview-origin.mjs build --baseline-source-sha <sha> | check --url <localhost-url> --expected-source-sha <sha>');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.command === 'build') await build(args.baselineSourceSha);
    else await check(args.url, args.expectedSourceSha);
  } catch (error) {
    process.stderr.write(`Preview origin check failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
