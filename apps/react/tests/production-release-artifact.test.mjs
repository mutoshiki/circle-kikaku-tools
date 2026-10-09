import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import test from 'node:test';
import {
  computeAssetDigest,
  createPagesArchive,
  verifyCurrentRelease,
} from '../tools/production-release-artifact.mjs';

const sourceSha = 'a'.repeat(40);
const files = new Map([
  ['index.html', Buffer.from('<main>React</main>')],
  ['assets/app.js', Buffer.from('console.log("release")')],
]);
const assetDigest = computeAssetDigest(files);
files.set('release-build.json', Buffer.from(JSON.stringify({ sourceSha, assetDigest })));
const manifest = { sourceSha, assetDigest };
const archiveBuffer = createPagesArchive(files);
const record = {
  runId: '12345',
  runAttempt: 1,
  sourceSha,
  assetDigest,
  archiveSha256: createHash('sha256').update(archiveBuffer).digest('hex'),
  workflowPath: '.github/workflows/react-production-release.yml',
};
const successfulRun = {
  id: 12345,
  run_attempt: 1,
  status: 'completed',
  conclusion: 'success',
  head_sha: sourceSha,
  head_branch: 'main',
  event: 'workflow_dispatch',
  path: `${record.workflowPath}@main`,
};

test('verified successful Pages release accepts its matching manifest and exact payload', () => {
  const payload = verifyCurrentRelease({ archiveBuffer, record, currentManifest: manifest, successfulRun });
  assert.deepEqual([...payload.keys()], ['assets/app.js', 'index.html', 'release-build.json']);
});

test('asset digest is independent of enumeration order and excludes its own manifest', () => {
  const one = new Map([
    ['zeta.svg', Buffer.from('<svg/>')],
    ['日本語/画像.png', Buffer.from([0, 1, 2])],
    ['release-build.json', Buffer.from('manifest is not self-hashed')],
  ]);
  const two = new Map([...one].reverse());
  assert.equal(computeAssetDigest(one), computeAssetDigest(two));
});

test('digest CLI reads a Pages build directory using the release digest algorithm', () => {
  const buildDirectory = mkdtempSync(path.join(tmpdir(), 'react-pages-digest-'));
  try {
    mkdirSync(path.join(buildDirectory, 'assets'), { recursive: true });
    writeFileSync(path.join(buildDirectory, 'index.html'), '<main>Build</main>');
    writeFileSync(path.join(buildDirectory, 'assets', 'route.svg'), '<svg/>');
    writeFileSync(path.join(buildDirectory, 'release-build.json'), '{"sourceSha":"placeholder"}');
    const expectedDigest = computeAssetDigest(new Map([
      ['index.html', Buffer.from('<main>Build</main>')],
      ['assets/route.svg', Buffer.from('<svg/>')],
      ['release-build.json', Buffer.from('{"sourceSha":"placeholder"}')],
    ]));
    const actualDigest = execFileSync(process.execPath, [
      fileURLToPath(new URL('../tools/production-release-artifact.mjs', import.meta.url)), 'digest', buildDirectory,
    ], { encoding: 'utf8' }).trim();
    assert.equal(actualDigest, expectedDigest);
  } finally {
    rmSync(buildDirectory, { recursive: true, force: true });
  }
});

test('simulated rollback Pages deploy restores the exact published SHA and asset digest', () => {
  const deployDirectory = mkdtempSync(path.join(tmpdir(), 'react-pages-rollback-deploy-'));
  try {
    const verifiedPayload = verifyCurrentRelease({ archiveBuffer, record, currentManifest: manifest, successfulRun });
    for (const [filePath, contents] of verifiedPayload) {
      const destination = path.join(deployDirectory, ...filePath.split('/'));
      mkdirSync(path.dirname(destination), { recursive: true });
      writeFileSync(destination, contents);
    }
    const restoredPayload = new Map([...verifiedPayload.keys()].map(filePath => [
      filePath,
      readFileSync(path.join(deployDirectory, ...filePath.split('/'))),
    ]));
    const restoredManifest = JSON.parse(restoredPayload.get('release-build.json').toString('utf8'));
    assert.equal(restoredManifest.sourceSha, sourceSha);
    assert.equal(restoredManifest.assetDigest, assetDigest);
    assert.equal(computeAssetDigest(restoredPayload), assetDigest);
    assert.deepEqual([...restoredPayload], [...verifiedPayload]);
  } finally {
    rmSync(deployDirectory, { recursive: true, force: true });
  }
});

test('release archive and record must match the currently published SHA and digest', () => {
  assert.throws(() => verifyCurrentRelease({
    archiveBuffer,
    record,
    currentManifest: { ...manifest, sourceSha: 'b'.repeat(40) },
    successfulRun,
  }), /published manifest/);
  assert.throws(() => verifyCurrentRelease({
    archiveBuffer,
    record: { ...record, assetDigest: 'f'.repeat(64) },
    currentManifest: manifest,
    successfulRun,
  }), /manifest|digest/);
});

test('release payload checksum and successful same-SHA release provenance are mandatory', () => {
  assert.throws(() => verifyCurrentRelease({
    archiveBuffer: Buffer.from('tampered'), record, currentManifest: manifest, successfulRun,
  }), /archive checksum/);
  assert.throws(() => verifyCurrentRelease({
    archiveBuffer,
    record,
    currentManifest: manifest,
    successfulRun: { ...successfulRun, conclusion: 'failure' },
  }), /successful release run/);
  assert.throws(() => verifyCurrentRelease({
    archiveBuffer,
    record,
    currentManifest: manifest,
    successfulRun: { ...successfulRun, head_sha: 'b'.repeat(40) },
  }), /successful release run/);
  assert.throws(() => verifyCurrentRelease({
    archiveBuffer,
    record,
    currentManifest: manifest,
    successfulRun: { ...successfulRun, run_attempt: 2 },
  }), /successful release run/);
  assert.throws(() => verifyCurrentRelease({
    archiveBuffer,
    record,
    currentManifest: manifest,
    successfulRun: { ...successfulRun, path: '.github/workflows/untrusted.yml@main' },
  }), /successful release run/);
});

test('missing archive metadata is rejected instead of producing a partial rollback payload', () => {
  assert.throws(() => verifyCurrentRelease({
    archiveBuffer,
    record: undefined,
    currentManifest: manifest,
    successfulRun,
  }), /release record is incomplete/);
});

test('archive rejects path traversal before extraction', () => {
  const maliciousArchive = gzipSync(Buffer.from(JSON.stringify({
    version: 1,
    files: [{ path: '../escape.txt', content: 'ZXNjYXBl' }],
  })));
  assert.throws(() => verifyCurrentRelease({
    archiveBuffer: maliciousArchive,
    record: { ...record, archiveSha256: createHash('sha256').update(maliciousArchive).digest('hex') },
    currentManifest: manifest,
    successfulRun,
  }), /unsafe path/);
});
