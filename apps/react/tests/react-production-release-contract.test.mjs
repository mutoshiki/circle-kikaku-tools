import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync(new URL('../../../.github/workflows/react-production-release.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const ciWorkflow = readFileSync(new URL('../../../.github/workflows/quality-guard.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const smoke = readFileSync(new URL('./production/production-smoke.spec.js', import.meta.url), 'utf8');
const roomHelper = readFileSync(new URL('./production/firebase-smoke-room.mjs', import.meta.url), 'utf8');
const cleanup = readFileSync(new URL('../tools/cleanup-production-smoke.mjs', import.meta.url), 'utf8');

function job(name) {
  const start = workflow.indexOf(`\n  ${name}:\n`);
  assert.notEqual(start, -1, `release workflow job "${name}" exists`);
  const body = workflow.slice(start + name.length + 4);
  const nextJob = body.search(/^  [a-z][a-z-]*:|^permissions:/m);
  return body.slice(0, nextJob === -1 ? undefined : nextJob);
}

test('React production Pages deployments are restricted to a verified main dispatch', () => {
  assert.match(workflow, /^on:\n  workflow_dispatch:\s*$/m);
  assert.doesNotMatch(workflow, /^  (?:push|pull_request|pull_request_target):/m);

  for (const name of ['release-gate', 'prepare', 'promotion', 'rollback']) {
    assert.match(job(name), /if:\s*github\.ref == 'refs\/heads\/main'/, `${name} is main-only`);
  }

  assert.match(job('prepare'), /needs:\s*release-gate/);
  assert.match(job('promotion'), /needs:\s*\[prepare\]/);
  const promotion = job('promotion');
  const orderedSteps = [
    'id: compatibility-deployment',
    'artifact_name: github-pages-compatibility',
    'id: compatibility-smoke',
    'id: compatibility-cleanup',
    'id: root-deployment',
    'artifact_name: github-pages-react-root',
    'id: root-smoke',
    'id: root-cleanup',
  ].map(step => promotion.indexOf(step));
  assert.ok(orderedSteps.every(index => index >= 0));
  assert.deepEqual(orderedSteps, [...orderedSteps].sort((a, b) => a - b));
  assert.equal((promotion.match(/npm ci --no-audit --no-fund/g) || []).length, 1);
  assert.equal((promotion.match(/playwright install --with-deps chromium webkit/g) || []).length, 1);
  assert.match(promotion, /outputs:[\s\S]*root_deployment_outcome:[\s\S]*steps\.root-deployment\.outcome/);
  assert.match(promotion, /id: root-deployment\s+if: success\(\) && steps\.compatibility-smoke\.outcome == 'success' && steps\.compatibility-cleanup\.outcome == 'success'/);
  assert.match(job('cleanup-recovery'), /if: always\(\) && needs\.prepare\.result == 'success' && needs\.promotion\.result != 'success'/);
  assert.match(job('cleanup-recovery'), /needs:\s*\[prepare, promotion\]/);
  assert.match(job('rollback'), /needs:\s*\[prepare, promotion, cleanup-recovery\]/);
  assert.match(job('rollback'), /needs\.promotion\.outputs\.root_deployment_outcome == 'failure' \|\|/);
  assert.match(job('prepare'), /Build React app once for both deployment paths/);

  for (const browser of ['Chromium', 'WebKit', 'visual and layout']) {
    assert.match(ciWorkflow, new RegExp(`Require every React ${browser} test to pass on the PR head`));
  }
  assert.doesNotMatch(ciWorkflow, /Run the same React .* suite on exact PR base/);
});

test('production Firebase smoke uses browser-origin auth and keeps its room marker guard', () => {
  assert.match(smoke, /const baseURL = process\.env\.REACT_PRODUCTION_SMOKE_BASE_URL/);
  assert.match(smoke, /seedProductionSmokeRoom\(page/);
  assert.match(smoke, /cleanupProductionSmokeRoom\(cleanupPage/);
  assert.match(smoke, /if \(!page\.isClosed\(\)\) await page\.close\(\)/);
  assert.doesNotMatch(smoke, /signInAnonymously|initializeApp\(config/);
  assert.match(roomHelper, /referrerPolicy: 'origin'/);
  assert.match(roomHelper, /existingMarker !== marker/);
  assert.match(roomHelper, /Reserved smoke room contains unmarked data; no data was changed/);
  assert.match(cleanup, /chromium\.launch/);
  for (const name of ['prepare', 'promotion', 'cleanup-recovery']) assert.match(job(name), /secrets\.REACT_FIREBASE_API_KEY/);
  assert.match(job('prepare'), /secrets\.REACT_MAPS_API_KEY/);
});
