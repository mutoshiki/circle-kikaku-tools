import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import test from 'node:test';
import { buildHandoffRequest } from '../src/services/handoff-export.js';

test('handoff request stores a digest and only selected response keys', async () => {
  const token = 'h_' + 'a'.repeat(64);
  const request = await buildHandoffRequest({
    projectId: 'PROJECT123', token, responseKeys: 'r_123456789012,r_abcdefghijkl',
    manualParticipantIds: ['manual-private-id'],
    jobId: 'handoff-request-000001', requestedAt: 1_797_000_000_000, cryptoApi: webcrypto,
  });
  assert.deepEqual(request, {
    jobId: 'handoff-request-000001', protocolVersion: 1,
    input: { projectId: 'PROJECT123', tokenHash: createHash('sha256').update(token).digest('hex'), responseKeys: 'r_123456789012,r_abcdefghijkl', manualParticipantHashes: createHash('sha256').update('handoff-request-000001:manual-private-id').digest('hex') },
    requestedAt: 1_797_000_000_000, state: 'queued',
  });
  assert.equal(JSON.stringify(request).includes(token), false);
  assert.equal(JSON.stringify(request).includes('manual-private-id'), false);
});

test('handoff request rejects malformed capability, duplicate keys, and more than 200 keys', async () => {
  const base = { projectId: 'PROJECT123', token: 'h_' + 'a'.repeat(64), responseKeys: 'r_123456789012', jobId: 'handoff-request-000001', requestedAt: 1, cryptoApi: webcrypto };
  await assert.rejects(buildHandoffRequest({ ...base, token: 'bad' }), /引き継ぎ権限/);
  await assert.rejects(buildHandoffRequest({ ...base, responseKeys: 'r_123456789012,r_123456789012' }), /参加者の選択/);
  await assert.rejects(buildHandoffRequest({ ...base, responseKeys: Array.from({ length: 201 }, (_, i) => `r_${String(i).padStart(12, '0')}`).join(',') }), /参加者の選択/);
  await assert.rejects(buildHandoffRequest({ ...base, manualParticipantIds: Array.from({ length: 201 }, (_, i) => `private-${i}`) }), /参加者の選択/);
});
