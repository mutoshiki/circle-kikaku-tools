import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

async function assembleCompatibilityPages(options) {
  const assembly = await import('../tools/assemble-compatibility-pages.mjs');
  return assembly.assembleCompatibilityPages(options);
}

async function writeTree(root, entries) {
  for (const [relativePath, contents] of Object.entries(entries)) {
    const destination = path.join(root, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, contents);
  }
}

async function readTree(root) {
  const entries = new Map();
  async function walk(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(fullPath, relativePath);
      else entries.set(relativePath, await readFile(fullPath, 'utf8'));
    }
  }
  await walk(root);
  return entries;
}

test('compatibility assembly preserves root, replaces the old React alias completely, and installs the target alias', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'react-compat-assembly-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const preserved = path.join(root, 'preserved');
  const reactBuild = path.join(root, 'react-build');
  const legacy = path.join(root, 'legacy');
  const output = path.join(root, 'assembled');
  const oldManifest = JSON.stringify({ sourceSha: '1'.repeat(40), assetDigest: '1'.repeat(64) });
  const newManifest = JSON.stringify({ sourceSha: '2'.repeat(40), assetDigest: '2'.repeat(64) });

  await writeTree(preserved, {
    'index.html': 'last-good-root',
    'release-build.json': oldManifest,
    '.nojekyll': '',
    'assets/root.js': 'last-good-root-asset',
    'react/index.html': 'last-good-react',
    'react/release-build.json': oldManifest,
    'react/assets/old-only.js': 'must disappear',
    'legacy/index.html': 'previous-legacy',
    'legacy/assets/old.css': 'must disappear',
  });
  await writeTree(reactBuild, {
    'index.html': 'target-react',
    'release-build.json': newManifest,
    'assets/target.js': 'target-react-asset',
  });
  await writeTree(legacy, {
    'index.html': 'pinned-legacy',
    'assets/pinned.css': 'pinned-legacy-asset',
  });

  const manifests = await assembleCompatibilityPages({
    preservedPagesDirectory: preserved,
    reactBuildDirectory: reactBuild,
    legacyDirectory: legacy,
    outputDirectory: output,
  });

  assert.deepEqual(manifests, {
    rootManifest: { sourceSha: '1'.repeat(40), assetDigest: '1'.repeat(64) },
    reactManifest: { sourceSha: '2'.repeat(40), assetDigest: '2'.repeat(64) },
  });
  assert.deepEqual(await readTree(output), new Map([
    ['.nojekyll', ''],
    ['assets/root.js', 'last-good-root-asset'],
    ['index.html', 'last-good-root'],
    ['legacy/assets/pinned.css', 'pinned-legacy-asset'],
    ['legacy/index.html', 'pinned-legacy'],
    ['react/assets/target.js', 'target-react-asset'],
    ['react/index.html', 'target-react'],
    ['react/release-build.json', newManifest],
    ['release-build.json', oldManifest],
  ]));
});

test('compatibility assembly rejects an output path inside an input without changing that input', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'react-compat-overlap-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const preserved = path.join(root, 'preserved');
  const reactBuild = path.join(root, 'react-build');
  const legacy = path.join(root, 'legacy');
  await writeTree(preserved, { 'index.html': 'root', 'release-build.json': '{}', '.nojekyll': '' });
  await writeTree(reactBuild, { 'index.html': 'target', 'release-build.json': '{}' });
  await writeTree(legacy, { 'index.html': 'legacy' });

  await assert.rejects(assembleCompatibilityPages({
    preservedPagesDirectory: preserved,
    reactBuildDirectory: reactBuild,
    legacyDirectory: legacy,
    outputDirectory: path.join(preserved, 'nested-output'),
  }), /output directory must be disjoint from all input directories/);
  assert.deepEqual(await readTree(preserved), new Map([
    ['.nojekyll', ''],
    ['index.html', 'root'],
    ['release-build.json', '{}'],
  ]));
});

test('compatibility assembly rejects incomplete source trees before creating output', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'react-compat-invalid-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const preserved = path.join(root, 'preserved');
  const reactBuild = path.join(root, 'react-build');
  const legacy = path.join(root, 'legacy');
  const output = path.join(root, 'assembled');
  await writeTree(preserved, { 'index.html': 'root', 'release-build.json': '{}', '.nojekyll': '' });
  await writeTree(reactBuild, { 'release-build.json': '{}' });
  await writeTree(legacy, { 'index.html': 'legacy' });

  await assert.rejects(assembleCompatibilityPages({
    preservedPagesDirectory: preserved,
    reactBuildDirectory: reactBuild,
    legacyDirectory: legacy,
    outputDirectory: output,
  }), /React build is missing index.html/);
  await assert.rejects(readFile(path.join(output, 'index.html')), { code: 'ENOENT' });
});

test('compatibility assembly refuses an existing output directory without deleting its contents', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'react-compat-existing-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const preserved = path.join(root, 'preserved');
  const reactBuild = path.join(root, 'react-build');
  const legacy = path.join(root, 'legacy');
  const output = path.join(root, 'assembled');
  await writeTree(preserved, { 'index.html': 'root', 'release-build.json': '{}', '.nojekyll': '' });
  await writeTree(reactBuild, { 'index.html': 'target', 'release-build.json': '{}' });
  await writeTree(legacy, { 'index.html': 'legacy' });
  await writeTree(output, { 'keep.txt': 'do not overwrite' });

  await assert.rejects(assembleCompatibilityPages({
    preservedPagesDirectory: preserved,
    reactBuildDirectory: reactBuild,
    legacyDirectory: legacy,
    outputDirectory: output,
  }), /output directory already exists/);
  assert.equal(await readFile(path.join(output, 'keep.txt'), 'utf8'), 'do not overwrite');
});

test('compatibility assembly CLI writes the mixed-stage artifact and reports both release identities', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'react-compat-cli-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const preserved = path.join(root, 'preserved');
  const reactBuild = path.join(root, 'react-build');
  const legacy = path.join(root, 'legacy');
  const output = path.join(root, 'assembled');
  const oldManifest = JSON.stringify({ sourceSha: '3'.repeat(40), assetDigest: '3'.repeat(64) });
  const newManifest = JSON.stringify({ sourceSha: '4'.repeat(40), assetDigest: '4'.repeat(64) });
  await writeTree(preserved, { 'index.html': 'old-root', 'release-build.json': oldManifest, '.nojekyll': '' });
  await writeTree(reactBuild, { 'index.html': 'new-react', 'release-build.json': newManifest });
  await writeTree(legacy, { 'index.html': 'pinned-legacy' });

  const stdout = execFileSync(process.execPath, [
    fileURLToPath(new URL('../tools/assemble-compatibility-pages.mjs', import.meta.url)),
    preserved,
    reactBuild,
    legacy,
    output,
  ], { encoding: 'utf8' });

  assert.deepEqual(JSON.parse(stdout), {
    rootManifest: { sourceSha: '3'.repeat(40), assetDigest: '3'.repeat(64) },
    reactManifest: { sourceSha: '4'.repeat(40), assetDigest: '4'.repeat(64) },
  });
  assert.equal(await readFile(path.join(output, 'index.html'), 'utf8'), 'old-root');
  assert.equal(await readFile(path.join(output, 'react', 'index.html'), 'utf8'), 'new-react');
  assert.equal(await readFile(path.join(output, 'legacy', 'index.html'), 'utf8'), 'pinned-legacy');
});
