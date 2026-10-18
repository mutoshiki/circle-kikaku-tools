import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test, { after, before } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, get, set } from 'firebase/database';

const projectId = 'demo-circle-kikaku-tools';
const now = Date.now();
let env;

before(async () => {
  const rules = await readFile(new URL('../firebase/database.rules.json', import.meta.url), 'utf8');
  env = await initializeTestEnvironment({ projectId, database: { rules, host: '127.0.0.1', port: 9000 } });
});

after(async () => { await env?.cleanup(); });

async function seed(accepting = true, acceptanceMode = 'test') {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async context => {
    await set(ref(context.database()), {
      formMakerV1: {
        workers: { 'worker-uid': true },
        status: { accepting, state: accepting ? 'ready' : 'paused', dailyCount: 0, dailyLimit: 40, updatedAt: now, errorCode: '', ...(acceptanceMode === null ? {} : { acceptanceMode }) },
        testOwners: { 'registered-uid': true },
        users: {},
      },
    });
  });
}

function reservation(uid, kind = 'create', requestHash = 'a'.repeat(64), jobId = 'request-000000000001') {
  return { uid, jobId, kind, requestHash, requestedAt: now };
}

function creationJob(slotId = '01', requestHash = 'a'.repeat(64)) {
  return {
    jobId: 'request-000000000001', protocolVersion: 1, admissionSlotId: slotId,
    input: { planName: '合成企画', editorEmail: 'tester@example.com', eventDate: '', deadline: '', description: '', handoffTokenHash: 'b'.repeat(64) },
    inputHash: requestHash, requestedAt: now, state: 'queued',
  };
}

function handoffJob(slotId = '02', tokenHash = 'c'.repeat(64)) {
  return {
    jobId: 'handoff-request-000001', protocolVersion: 1, admissionSlotId: slotId,
    input: { projectId: 'P1C34AE0E8277438BBAE', tokenHash, responseKeys: '', manualParticipantHashes: 'd'.repeat(64) },
    requestedAt: now, state: 'queued',
  };
}

test('only a registered test UID may reserve and submit create or handoff jobs', async () => {
  await seed();
  const registered = env.authenticatedContext('registered-uid').database();
  const other = env.authenticatedContext('other-uid').database();
  await assertSucceeds(set(ref(registered, 'formMakerV1/admission/slots/01'), reservation('registered-uid')));
  await assertSucceeds(set(ref(registered, 'formMakerV1/users/registered-uid/jobs/request-000000000001'), creationJob()));

  const handoffHash = 'c'.repeat(64);
  await assertSucceeds(set(ref(registered, 'formMakerV1/admission/slots/02'), reservation('registered-uid', 'handoff', handoffHash, 'handoff-request-000001')));
  await assertSucceeds(set(ref(registered, 'formMakerV1/users/registered-uid/handoffs/handoff-request-000001'), handoffJob('02', handoffHash)));

  await assertFails(set(ref(other, 'formMakerV1/admission/slots/03'), reservation('other-uid')));
  await assertFails(set(ref(other, 'formMakerV1/users/other-uid/jobs/request-000000000002'), creationJob('03')));
  await assertFails(set(ref(other, 'formMakerV1/admission/slots/04'), reservation('other-uid', 'handoff', handoffHash)));
  await assertFails(set(ref(other, 'formMakerV1/users/other-uid/handoffs/handoff-request-000002'), handoffJob('04', handoffHash)));
});

test('paused status overrides test-owner access and open mode remains backward compatible', async () => {
  await seed(false, 'test');
  const registered = env.authenticatedContext('registered-uid').database();
  await assertFails(set(ref(registered, 'formMakerV1/admission/slots/01'), reservation('registered-uid')));

  await seed(true, null);
  const legacy = env.authenticatedContext('legacy-client').database();
  await assertSucceeds(set(ref(legacy, 'formMakerV1/admission/slots/01'), reservation('legacy-client')));
  await assertSucceeds(set(ref(legacy, 'formMakerV1/users/legacy-client/jobs/request-000000000001'), creationJob()));
});

test('clients can read only their own test-owner entry and cannot self-register or enumerate', async () => {
  await seed();
  const registered = env.authenticatedContext('registered-uid').database();
  const other = env.authenticatedContext('other-uid').database();
  const worker = env.authenticatedContext('worker-uid').database();
  await assertSucceeds(get(ref(registered, 'formMakerV1/testOwners/registered-uid')));
  await assertFails(get(ref(registered, 'formMakerV1/testOwners/other-uid')));
  await assertFails(get(ref(registered, 'formMakerV1/testOwners')));
  await assertFails(set(ref(other, 'formMakerV1/testOwners/other-uid'), true));
  await assertSucceeds(get(ref(worker, 'formMakerV1/testOwners')));
  await assertSucceeds(set(ref(worker, 'formMakerV1/testOwners/other-uid'), true));
});
