import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import test from 'node:test';
import { assertHandoffAdmission, createHandoffClient } from '../src/services/handoff-client.js';

const crypto = webcrypto;
const payload = { action: 'handoff-export', projectId: 'PROJECT123', token: `h_${'a'.repeat(64)}`, responses: 'r_123456789012', manualParticipantIds: [] };

test('test mode only admits the explicitly registered test owner', () => {
  assertHandoffAdmission({ accepting: true, acceptanceMode: 'test' }, true);
  assert.throws(() => assertHandoffAdmission({ accepting: true, acceptanceMode: 'test' }, false), /限定確認中/);
  assert.throws(() => assertHandoffAdmission({ accepting: false, acceptanceMode: 'test' }, true), /受付を停止/);
  assert.throws(() => assertHandoffAdmission({ accepting: true, acceptanceMode: 'broken' }, true), /受付状態/);
  assertHandoffAdmission({ accepting: true }, false);
});

test('worker handoff submits one request and returns only the private Drive result', async () => {
  const enqueued = [];
  const reads = [];
  const client = createHandoffClient({
    crypto,
    wait: async () => {},
    transport: {
      async enqueueHandoffExport(request) { enqueued.push(request); },
      async getHandoffExport(jobId) {
        reads.push(jobId);
        return reads.length === 1 ? { state: 'running' } : {
          state: 'completed',
          result: { downloadUrl: 'https://drive.google.com/uc?export=download&id=file', count: 1, expiresAt: 123 },
        };
      },
    },
  });

  assert.deepEqual(await client(payload), {
    ok: true,
    downloadUrl: 'https://drive.google.com/uc?export=download&id=file',
    count: 1,
    expiresAt: 123,
  });
  assert.equal(enqueued.length, 1);
  assert.match(enqueued[0].jobId, /^handoff_[A-Za-z0-9_-]{16,80}$/);
  assert.equal(enqueued[0].token, payload.token);
  assert.equal(reads.length, 2);
});

test('worker failure, ambiguous result, invalid link, and timeout remain visible as safe errors', async () => {
  const makeClient = state => createHandoffClient({
    crypto,
    maxWaitMs: 50,
    transport: {
      async enqueueHandoffExport() {},
      async getHandoffExport() { return state; },
    },
  });
  await assert.rejects(makeClient({ state: 'failed' })(payload), /CSVを準備できませんでした/);
  await assert.rejects(makeClient({ state: 'unknown' })(payload), /同じ画面からもう一度/);
  await assert.rejects(makeClient({ state: 'completed', result: { downloadUrl: 'https://example.com/file', count: 1 } })(payload), /保存結果を確認できません/);
  await assert.rejects(makeClient({ state: 'running' })(payload), /同じ画面からもう一度/);
  await assert.rejects(makeClient({ state: 'running' })({ ...payload, token: 'bad' }), /引き継ぎ権限/);
});

test('an uncertain handoff retry reuses its stored job ID and does not enqueue a second CSV', async () => {
  const values = new Map();
  const storage = {
    read: key => values.get(key) ?? null,
    write: (key, value) => values.set(key, value),
    remove: key => values.delete(key),
  };
  const enqueued = [];
  let enqueueCount = 0;
  const client = createHandoffClient({
    crypto,
    storage,
    maxWaitMs: 30,
    pollIntervalMs: 10,
    wait: async () => {},
    transport: {
      async enqueueHandoffExport(request) { enqueued.push(request.jobId); enqueueCount += 1; },
      async getHandoffExport() {
        return enqueueCount === 1 ? { state: 'running' } : {
          state: 'completed', result: { downloadUrl: 'https://drive.google.com/uc?export=download&id=file', count: 1, expiresAt: 123 },
        };
      },
    },
  });

  await assert.rejects(client(payload), /同じ画面からもう一度/);
  const keys = [...values.keys()];
  assert.equal(keys.length, 1);
  assert.equal(JSON.stringify(keys).includes(payload.token), false);
  await client(payload);
  assert.equal(enqueued.length, 2, 'the same idempotency key is retried for status recovery');
  assert.equal(enqueued[0], enqueued[1]);
  assert.equal(values.size, 0, 'the recovery key is removed after confirmed success');
});
