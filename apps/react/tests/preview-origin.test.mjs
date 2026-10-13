import test from 'node:test';
import assert from 'node:assert/strict';
import { assertLocalPreviewEnvironment, validatePreviewOrigin } from '../tools/preview-origin.mjs';

const sha = char => char.repeat(40);
const fingerprint = char => char.repeat(64);
const baseline = {
  schemaVersion: 1,
  baselineSourceSha: sha('a'),
  worktreeHead: sha('b'),
  sourceRoot: 'C:/work/circle-kikaku-tools',
  sourceFingerprint: fingerprint('c'),
  builtAt: '2026-10-11T12:00:00.000Z',
  dirty: true,
  syncMode: 'local',
  assets: [{ path: 'index.html', sha256: fingerprint('e') }],
};
const current = {
  expectedSourceSha: sha('a'),
  worktreeHead: sha('b'),
  sourceRoot: 'C:/work/circle-kikaku-tools',
  sourceFingerprint: fingerprint('c'),
};

test('accepts a preview built from the requested baseline and unchanged source tree', () => {
  assert.deepEqual(validatePreviewOrigin(baseline, current), { ok: true, reasons: [] });
});

test('rejects a preview built from a different public baseline SHA', () => {
  const result = validatePreviewOrigin({ ...baseline, baselineSourceSha: sha('d') }, current);
  assert.equal(result.ok, false);
  assert.match(result.reasons.join(' '), /baseline/i);
});

test('rejects a stale build after source files change', () => {
  const result = validatePreviewOrigin(baseline, { ...current, sourceFingerprint: fingerprint('d') });
  assert.equal(result.ok, false);
  assert.match(result.reasons.join(' '), /fingerprint/i);
});

test('rejects a different worktree even when it has the same commit', () => {
  const result = validatePreviewOrigin(baseline, { ...current, sourceRoot: 'C:/work/other-checkout' });
  assert.equal(result.ok, false);
  assert.match(result.reasons.join(' '), /worktree/i);
});

test('rejects missing or malformed build metadata', () => {
  assert.equal(validatePreviewOrigin(null, current).ok, false);
  assert.equal(validatePreviewOrigin({ ...baseline, worktreeHead: 'unknown' }, current).ok, false);
});

test('allows only local sync and rejects Firebase config from the effective Vite environment', () => {
  assert.equal(assertLocalPreviewEnvironment({}), 'local');
  assert.throws(() => assertLocalPreviewEnvironment({ VITE_REACT_SYNC_MODE: 'production' }), /local sync/i);
  assert.throws(() => assertLocalPreviewEnvironment({ VITE_REACT_FIREBASE_CONFIG: '{"projectId":"example"}' }), /Firebase config/i);
});
