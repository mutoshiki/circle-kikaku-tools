import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { createMockUserToken } from '@firebase/util';
import { ref, set } from 'firebase/database';

const projectId = 'demo-circle-kikaku-tools';
const uid = 'registered-uid';
const now = Date.now();
const rules = await readFile(new URL('../firebase/database.rules.json', import.meta.url), 'utf8');
const environment = await initializeTestEnvironment({
  projectId,
  database: { rules, host: '127.0.0.1', port: 9000 },
});
const token = createMockUserToken({ sub: uid }, { projectId });
const slotUrl = `http://127.0.0.1:9000/formMakerV1/admission/slots/01.json?ns=${projectId}&auth=${encodeURIComponent(token)}`;
const reservation = {
  uid,
  jobId: 'request-000000000001',
  kind: 'create',
  requestHash: 'a'.repeat(64),
  requestedAt: now,
};

try {
  await environment.clearDatabase();
  await environment.withSecurityRulesDisabled(async context => {
    await set(ref(context.database(), 'formMakerV1'), {
      workers: { 'worker-uid': true },
      status: { accepting: true, state: 'ready', acceptanceMode: 'test', dailyCount: 0, dailyLimit: 16, updatedAt: now },
      testOwners: { [uid]: true },
    });
  });

  const emptyRead = await fetch(slotUrl);
  assert.equal(emptyRead.status, 401, 'slot owners cannot read an empty shared slot');

  const firstWrite = await fetch(slotUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reservation),
  });
  assert.equal(firstWrite.status, 200, 'a plain first PUT is allowed by the write-only slot rule');

  const overwrite = await fetch(slotUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...reservation, jobId: 'replacement-request-0001' }),
  });
  assert.equal(overwrite.status, 401, 'the rule still prevents replacing an occupied slot');
  const stored = await (await fetch(slotUrl.replace(`auth=${encodeURIComponent(token)}`, `auth=${encodeURIComponent(createMockUserToken({ sub: 'worker-uid' }, { projectId }))}`))).json();
  assert.equal(stored.jobId, reservation.jobId, 'the original reservation survives an overwrite attempt');

  await environment.clearDatabase();
  await environment.withSecurityRulesDisabled(async context => {
    await set(ref(context.database(), 'formMakerV1'), {
      workers: { 'worker-uid': true },
      status: { accepting: true, state: 'ready', acceptanceMode: 'test', dailyCount: 0, dailyLimit: 16, updatedAt: now },
      testOwners: { [uid]: true },
    });
  });
  const conditionalWrite = await fetch(slotUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'if-match': 'null_etag' },
    body: JSON.stringify(reservation),
  });
  assert.equal(conditionalWrite.status, 401, 'conditional PUT requires read permission and reproduces the production failure');

  console.log('Firebase REST admission checks passed: first-write succeeds, overwrite is denied, null_etag reproduces 401.');
} finally {
  await environment.cleanup();
}
