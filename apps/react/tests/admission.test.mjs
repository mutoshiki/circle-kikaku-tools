import assert from 'node:assert/strict';
import test from 'node:test';
import { reserveAdmissionSlot } from '../src/sync/firebase-transport.js';

const request = {
  jobId: 'handoff-request-000001',
  input: { tokenHash: 'a'.repeat(64) },
  requestedAt: 1_797_000_000_000,
};
const config = { databaseURL: 'https://demo.example.invalid/' };
const auth = { currentUser: { uid: 'owner-device', async getIdToken() { return 'test-token'; } } };

function mockSdk(existing = null) {
  const reads = [];
  return {
    reads,
    sdk: {
      ref(_db, path) { return path; },
      async get(path) { reads.push(path); if (existing) return { val: () => existing }; throw new Error('permission denied'); },
    },
  };
}

test('handoff admission reserves an unused fixed slot before writing a request', async () => {
  const calls = [];
  const { sdk, reads } = mockSdk();
  let writes = 0;
  const reserved = await reserveAdmissionSlot({
    config, db: {}, dbSdk: sdk, auth, request, kind: 'handoff',
    async fetchImpl(url, options) {
      calls.push({ url, options });
      writes += 1;
      return { ok: writes === 2, status: writes === 1 ? 403 : 200 };
    },
  });
  assert.equal(reserved.slotId.length, 2);
  assert.equal(reserved.requestedAt, request.requestedAt);
  assert.equal(calls.length, 2);
  const reservation = JSON.parse(calls.at(-1).options.body);
  assert.equal(reservation.uid, auth.currentUser.uid);
  assert.equal(reservation.jobId, request.jobId);
  assert.equal(reservation.kind, 'handoff');
  assert.equal(reservation.requestHash, request.input.tokenHash);
  assert.equal(calls.at(-1).options.headers['if-match'], 'null_etag');
  assert.equal(reads.length, 1, 'the first occupied slot is checked for an idempotent same-owner retry');
});

test('handoff admission reuses an interrupted same-owner reservation and its original time', async () => {
  const { sdk, reads } = mockSdk({ uid: 'owner-device', jobId: request.jobId, kind: 'handoff', requestHash: request.input.tokenHash, requestedAt: request.requestedAt - 1000 });
  const reserved = await reserveAdmissionSlot({
    config, db: {}, dbSdk: sdk, auth, request: { ...request, requestedAt: request.requestedAt + 5000 }, kind: 'handoff',
    async fetchImpl() { return { ok: false, status: 403 }; },
  });
  assert.equal(reserved.requestedAt, request.requestedAt - 1000);
  assert.equal(reads.length, 1);
});

test('handoff admission gives a safe response when all 40 shared slots are unavailable', async () => {
  const { sdk } = mockSdk();
  let attempts = 0;
  await assert.rejects(reserveAdmissionSlot({
    config, db: {}, dbSdk: sdk, auth, request, kind: 'handoff',
    async fetchImpl() { attempts += 1; return { ok: false, status: 403 }; },
  }), /受付枠を確保できません/);
  assert.equal(attempts, 40);
});
