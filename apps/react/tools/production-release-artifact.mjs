#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';

const expectedWorkflowPath = '.github/workflows/react-production-release.yml';
const releaseTagPrefix = 'react-pages-';
const payloadAssetName = 'react-pages-payload.json.gz';
const recordAssetName = 'release-record.json';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const isReleaseWorkflowPath = value => typeof value === 'string'
  && (value === expectedWorkflowPath || value.startsWith(`${expectedWorkflowPath}@`));

function assertSafePath(filePath) {
  if (typeof filePath !== 'string' || !filePath || filePath.includes('\\') || filePath.includes('\0')) {
    throw new Error(`unsafe path in Pages payload: ${String(filePath)}`);
  }
  const segments = filePath.split('/');
  if (filePath.startsWith('/') || segments.some(segment => !segment || segment === '.' || segment === '..')) {
    throw new Error(`unsafe path in Pages payload: ${filePath}`);
  }
  return filePath;
}

export function computeAssetDigest(files) {
  const manifestPaths = new Set(['release-build.json', 'react/release-build.json']);
  const entries = [...files.entries()]
    .map(([filePath, contents]) => [assertSafePath(filePath), contents])
    .filter(([filePath]) => !manifestPaths.has(filePath))
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  const lines = entries.map(([filePath, contents]) => `${sha256(contents)}  ./${assertSafePath(filePath)}\n`).join('');
  return sha256(lines);
}

export function createPagesArchive(files) {
  const sorted = [...files.entries()]
    .map(([filePath, contents]) => [assertSafePath(filePath), Buffer.from(contents)])
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  return gzipSync(Buffer.from(JSON.stringify({
    version: 1,
    files: sorted.map(([filePath, contents]) => ({ path: filePath, content: contents.toString('base64') })),
  })), { level: 9, mtime: 0 });
}

export function decodePagesArchive(archiveBuffer) {
  let decoded;
  try {
    decoded = JSON.parse(gunzipSync(archiveBuffer).toString('utf8'));
  } catch {
    throw new Error('invalid Pages payload archive');
  }
  if (decoded?.version !== 1 || !Array.isArray(decoded.files)) throw new Error('unsupported Pages payload archive');
  const files = new Map();
  for (const file of decoded.files) {
    const filePath = assertSafePath(file?.path);
    if (files.has(filePath) || typeof file.content !== 'string') throw new Error(`invalid Pages payload file: ${filePath}`);
    const contents = Buffer.from(file.content, 'base64');
    if (contents.toString('base64') !== file.content) throw new Error(`invalid Pages payload file: ${filePath}`);
    files.set(filePath, contents);
  }
  if (!files.has('index.html') || !files.has('release-build.json')) throw new Error('Pages payload is missing its entry point or release manifest');
  return files;
}

export function verifyCurrentRelease({ archiveBuffer, record, currentManifest, successfulRun }) {
  if (!record || !/^[a-f0-9]{40}$/.test(record.sourceSha || '') || !/^[a-f0-9]{64}$/.test(record.assetDigest || '')) {
    throw new Error('release record is incomplete');
  }
  if (currentManifest?.sourceSha !== record.sourceSha || currentManifest?.assetDigest !== record.assetDigest) {
    throw new Error('release record does not match the currently published manifest');
  }
  if (record.workflowPath !== expectedWorkflowPath || !/^\d+$/.test(String(record.runId))
    || !/^\d+$/.test(String(record.runAttempt))) {
    throw new Error('release record provenance is invalid');
  }
  if (sha256(archiveBuffer) !== record.archiveSha256) throw new Error('Pages payload archive checksum does not match its release record');
  if (!successfulRun || String(successfulRun.id) !== String(record.runId)
    || Number(successfulRun.run_attempt) !== Number(record.runAttempt)
    || successfulRun.status !== 'completed' || successfulRun.conclusion !== 'success'
    || successfulRun.head_sha !== record.sourceSha || successfulRun.event !== 'workflow_dispatch'
    || successfulRun.head_branch !== 'main' || !isReleaseWorkflowPath(successfulRun.path)) {
    throw new Error('release record is not from a successful release run for the same SHA');
  }
  const files = decodePagesArchive(archiveBuffer);
  let bundledManifest;
  try { bundledManifest = JSON.parse(files.get('release-build.json').toString('utf8')); }
  catch { throw new Error('Pages payload contains an invalid release manifest'); }
  if (bundledManifest.sourceSha !== record.sourceSha || bundledManifest.assetDigest !== record.assetDigest) {
    throw new Error('Pages payload manifest does not match its release record');
  }
  if (computeAssetDigest(files) !== record.assetDigest) throw new Error('Pages payload asset digest does not match its release record');
  return files;
}

async function readPagesDirectory(root) {
  const files = new Map();
  async function visit(directory, prefix = '') {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`symlink is not allowed in Pages payload: ${relative}`);
      if (entry.isDirectory()) await visit(absolute, relative);
      else if (entry.isFile()) files.set(relative.split(path.sep).join('/'), await readFile(absolute));
    }
  }
  await visit(root);
  return files;
}

async function printDirectoryDigest(directory) {
  const files = await readPagesDirectory(directory);
  process.stdout.write(`${computeAssetDigest(files)}\n`);
}

async function writePagesDirectory(files, destination) {
  for (const [filePath, contents] of files) {
    const absolute = path.join(destination, ...filePath.split('/'));
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, contents, { flag: 'wx' });
  }
}

function gh(args, { json = true } = {}) {
  const output = execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return json ? JSON.parse(output) : output;
}

function getRepository() {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository || !/^[^/]+\/[^/]+$/.test(repository)) throw new Error('GITHUB_REPOSITORY is required');
  return repository;
}

function getReleaseRun(runId, runAttempt) {
  const repo = getRepository();
  return gh(['api', `repos/${repo}/actions/runs/${runId}/attempts/${runAttempt}`]);
}

function buildRecord({ runId, runAttempt, sourceSha, assetDigest, archiveBuffer }) {
  return {
    runId: String(runId),
    runAttempt: Number(runAttempt),
    sourceSha,
    assetDigest,
    archiveSha256: sha256(archiveBuffer),
    workflowPath: expectedWorkflowPath,
  };
}

function verifyPublishingRun(run, { runId, runAttempt, sourceSha }) {
  if (String(run.id) !== String(runId) || Number(run.run_attempt) !== Number(runAttempt)
    || run.head_sha !== sourceSha || run.head_branch !== 'main' || !isReleaseWorkflowPath(run.path)
    || run.event !== 'workflow_dispatch' || !['in_progress', 'completed'].includes(run.status)
    || (run.status === 'completed' && run.conclusion !== 'success')) {
    throw new Error('release publisher is not running for the requested trusted release run and SHA');
  }
}

async function publish([runId, sourceSha, assetDigest, payloadDirectory]) {
  if (!/^\d+$/.test(runId) || !/^[a-f0-9]{40}$/.test(sourceSha) || !/^[a-f0-9]{64}$/.test(assetDigest)) {
    throw new Error('publish requires a numeric run id, full source SHA, and asset digest');
  }
  const runAttempt = process.env.GITHUB_RUN_ATTEMPT || '1';
  if (!/^\d+$/.test(runAttempt)) throw new Error('GITHUB_RUN_ATTEMPT must be numeric');
  const files = await readPagesDirectory(payloadDirectory);
  const bundledManifest = JSON.parse(files.get('release-build.json')?.toString('utf8') || 'null');
  if (bundledManifest?.sourceSha !== sourceSha || bundledManifest?.assetDigest !== assetDigest || computeAssetDigest(files) !== assetDigest) {
    throw new Error('Pages payload does not match the requested production SHA and digest');
  }
  const archiveBuffer = createPagesArchive(files);
  const record = buildRecord({ runId, runAttempt, sourceSha, assetDigest, archiveBuffer });
  verifyPublishingRun(getReleaseRun(runId, runAttempt), { runId, runAttempt, sourceSha });
  const tag = `${releaseTagPrefix}${sourceSha}-${runId}-${runAttempt}`;
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'react-pages-release-'));
  try {
    const archivePath = path.join(temporaryDirectory, payloadAssetName);
    const recordPath = path.join(temporaryDirectory, recordAssetName);
    await writeFile(archivePath, archiveBuffer);
    await writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`);
    gh([
      'release', 'create', tag, archivePath, recordPath,
      '--target', sourceSha,
      '--title', `React Pages rollback ${sourceSha}`,
      '--notes', `Verified React Pages payload for ${sourceSha}; release run ${runId}.`,
      '--latest=false',
    ], { json: false });
    process.stdout.write(`Stored immutable Pages rollback payload for ${sourceSha}.\n`);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function getPublishedManifest(manifestUrl) {
  const response = await fetch(manifestUrl, { cache: 'no-store' });
  if (!response.ok) {
    const error = new Error(`published release manifest returned HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  const manifest = await response.json();
  if (!/^[a-f0-9]{40}$/.test(manifest?.sourceSha || '') || !/^[a-f0-9]{64}$/.test(manifest?.assetDigest || '')) {
    throw new Error('published release manifest is invalid');
  }
  return manifest;
}

function downloadReleaseAsset(tag, assetName, directory) {
  gh(['release', 'download', tag, '--pattern', assetName, '--dir', directory], { json: false });
}

function writeGithubOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) appendFileSync(outputPath, `${name}=${value}\n`);
}

function verifyPublishedFiles(files, currentManifest) {
  let bundledManifest;
  try { bundledManifest = JSON.parse(files.get('release-build.json')?.toString('utf8') || 'null'); }
  catch { throw new Error('rollback Pages artifact contains an invalid release manifest'); }
  if (bundledManifest?.sourceSha !== currentManifest.sourceSha || bundledManifest?.assetDigest !== currentManifest.assetDigest) {
    throw new Error('rollback Pages artifact does not match the currently published manifest');
  }
  if (computeAssetDigest(files) !== currentManifest.assetDigest) {
    throw new Error('rollback Pages artifact content digest does not match the currently published manifest');
  }
  return files;
}

async function bootstrapCurrentActionsArtifact(currentManifest, destination) {
  const repo = getRepository();
  const result = gh(['api', `repos/${repo}/actions/workflows/react-production-release.yml/runs?head_sha=${currentManifest.sourceSha}&per_page=100`]);
  const candidates = (result.workflow_runs || []).filter(run => run.head_sha === currentManifest.sourceSha
    && run.head_branch === 'main' && run.event === 'workflow_dispatch' && run.status === 'completed'
    && run.conclusion === 'success' && isReleaseWorkflowPath(run.path)).sort((a, b) => b.run_number - a.run_number);
  for (const run of candidates) {
    const artifactsResult = gh(['api', `repos/${repo}/actions/runs/${run.id}/artifacts`]);
    const artifact = (artifactsResult.artifacts || []).find(item => item.name === 'github-pages-react-root');
    if (!artifact || artifact.expired) continue;
    const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'react-pages-bootstrap-'));
    try {
      gh(['run', 'download', String(run.id), '--name', 'github-pages-react-root', '--dir', temporaryDirectory], { json: false });
      let payloadDirectory = temporaryDirectory;
      const directFiles = await readPagesDirectory(temporaryDirectory);
      if (!directFiles.has('index.html') || !directFiles.has('release-build.json')) {
        const tarPath = path.join(temporaryDirectory, 'artifact.tar');
        if (!directFiles.has('artifact.tar')) throw new Error(`successful release run ${run.id} did not contain a Pages artifact tarball`);
        payloadDirectory = path.join(temporaryDirectory, 'extracted');
        await mkdir(payloadDirectory, { recursive: true });
        execFileSync('tar', ['-xf', tarPath, '-C', payloadDirectory], { stdio: 'pipe' });
      }
      const files = verifyPublishedFiles(await readPagesDirectory(payloadDirectory), currentManifest);
      await rm(destination, { recursive: true, force: true });
      await mkdir(destination, { recursive: true });
      await writePagesDirectory(files, destination);
      writeGithubOutput('source_sha', currentManifest.sourceSha);
      writeGithubOutput('source', 'verified-actions-artifact');
      writeGithubOutput('published_sha', currentManifest.sourceSha);
      writeGithubOutput('published_asset_digest', currentManifest.assetDigest);
      process.stdout.write(`Verified current Pages rollback payload from successful run ${run.id}.\n`);
      return true;
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }
  return false;
}

async function fetchCurrent([manifestUrl, destination]) {
  if (!manifestUrl || !destination) throw new Error('fetch-current requires a manifest URL and destination path');
  const hasSavedRelease = await hasSavedPagesRelease();
  let currentManifest;
  try {
    currentManifest = await getPublishedManifest(manifestUrl);
  } catch (error) {
    if (!hasSavedRelease && error.status === 404) {
      writeGithubOutput('source', 'pinned-legacy-fallback');
      process.stderr.write('No current React manifest or saved React release exists yet; use the pinned legacy rollback artifact.\n');
      process.exitCode = 3;
      return;
    }
    throw error;
  }
  if (!hasSavedRelease) {
    if (await bootstrapCurrentActionsArtifact(currentManifest, destination)) return;
    writeGithubOutput('source', 'pinned-legacy-fallback');
    writeGithubOutput('published_sha', currentManifest.sourceSha);
    writeGithubOutput('published_asset_digest', currentManifest.assetDigest);
    process.stderr.write('No unexpired successful React Pages artifact exists for the current manifest; use the pinned legacy rollback artifact.\n');
    process.exitCode = 3;
    return;
  }
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'react-pages-fetch-'));
  try {
    const tags = await listSavedPagesReleaseTags();
    const matchingTags = tags.filter(tag => tag.startsWith(`${releaseTagPrefix}${currentManifest.sourceSha}-`));
    let verified;
    for (const tag of matchingTags) {
      const candidateDirectory = path.join(temporaryDirectory, sha256(tag));
      await mkdir(candidateDirectory, { recursive: true });
      try {
        const release = gh(['release', 'view', tag, '--json', 'assets'], { json: true });
        const assetNames = new Set(release.assets.map(asset => asset.name));
        if (!assetNames.has(payloadAssetName) || !assetNames.has(recordAssetName)) continue;
        downloadReleaseAsset(tag, payloadAssetName, candidateDirectory);
        downloadReleaseAsset(tag, recordAssetName, candidateDirectory);
        const archiveBuffer = await readFile(path.join(candidateDirectory, payloadAssetName));
        const record = JSON.parse(await readFile(path.join(candidateDirectory, recordAssetName), 'utf8'));
        const successfulRun = getReleaseRun(record.runId, record.runAttempt);
        const files = verifyCurrentRelease({ archiveBuffer, record, currentManifest, successfulRun });
        verified = { files, record };
        break;
      } catch {
        // A failed or incomplete release attempt must never be selected as a rollback source.
      }
    }
    if (!verified) throw new Error(`no successful verified rollback payload matches the published manifest SHA ${currentManifest.sourceSha}`);
    const { files, record } = verified;
    await rm(destination, { recursive: true, force: true });
    await mkdir(destination, { recursive: true });
    await writePagesDirectory(files, destination);
    writeGithubOutput('source_sha', record.sourceSha);
    writeGithubOutput('source', 'verified-github-release');
    writeGithubOutput('published_sha', currentManifest.sourceSha);
    writeGithubOutput('published_asset_digest', currentManifest.assetDigest);
    process.stdout.write(`Verified current Pages rollback payload: ${record.sourceSha} (${record.assetDigest}).\n`);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function hasSavedPagesRelease() {
  const tags = await listSavedPagesReleaseTags();
  for (const tag of tags) {
    const match = tag.match(/^react-pages-([a-f0-9]{40})-(\d+)-(\d+)$/);
    if (!match) continue;
    try {
      const run = getReleaseRun(match[2], match[3]);
      if (run.status === 'completed' && run.conclusion === 'success' && run.head_sha === match[1]
        && run.head_branch === 'main' && run.event === 'workflow_dispatch' && isReleaseWorkflowPath(run.path)) return true;
    } catch {
      // Ignore incomplete or unavailable release provenance; it is not a rollback candidate.
    }
  }
  return false;
}

async function listSavedPagesReleaseTags() {
  const repo = getRepository();
  const tags = gh(['api', `repos/${repo}/releases`, '--paginate', '--jq', '.[].tag_name'], { json: false });
  return tags.split(/\r?\n/).filter(tag => /^react-pages-[a-f0-9]{40}-\d+-\d+$/.test(tag));
}

async function main(args) {
  const [command, ...parameters] = args;
  if (command === 'digest' && parameters.length === 1) return printDirectoryDigest(parameters[0]);
  if (command === 'publish' && parameters.length === 4) return publish(parameters);
  if (command === 'fetch-current' && parameters.length === 2) return fetchCurrent(parameters);
  throw new Error('usage: production-release-artifact.mjs digest <pages-directory> | publish <run-id> <sha> <asset-digest> <pages-payload> | fetch-current <production-manifest-url> <destination>');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
