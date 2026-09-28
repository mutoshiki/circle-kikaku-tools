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

  for (const name of ['release-gate', 'prepare', 'compatibility-deploy', 'root-deploy', 'rollback']) {
    assert.match(job(name), /if:\s*github\.ref == 'refs\/heads\/main'/, `${name} is main-only`);
  }

  assert.match(job('prepare'), /needs:\s*release-gate/);
  assert.match(job('root-deploy'), /needs:\s*\[prepare, compatibility-smoke, compatibility-cleanup\]/);
  assert.match(job('compatibility-deploy'), /artifact_name:\s*github-pages-compatibility/);
  assert.match(job('root-deploy'), /artifact_name:\s*github-pages-react-root/);
  assert.match(job('prepare'), /Build React app once for both deployment paths/);

  for (const browser of ['Chromium', 'WebKit', 'visual and layout']) {
    assert.match(ciWorkflow, new RegExp(`Require every React ${browser} test to pass on the PR head`));
  }
  assert.doesNotMatch(ciWorkflow, /Run the same React .* suite on exact PR base/);
});

test('production Firebase smoke uses browser-origin auth and keeps its room marker guard', () => {
  assert.match(smoke, /seedProductionSmokeRoom\(page/);
  assert.match(smoke, /cleanupProductionSmokeRoom\(page/);
  assert.doesNotMatch(smoke, /signInAnonymously|initializeApp\(config/);
  assert.match(roomHelper, /referrerPolicy: 'origin'/);
  assert.match(roomHelper, /existingMarker !== marker/);
  assert.match(roomHelper, /Reserved smoke room contains unmarked data; no data was changed/);
  assert.match(cleanup, /chromium\.launch/);
  for (const name of ['prepare', 'compatibility-smoke', 'compatibility-cleanup', 'root-smoke', 'root-cleanup']) {
    assert.match(job(name), /secrets\.REACT_FIREBASE_API_KEY/);
  }
  assert.match(job('prepare'), /secrets\.REACT_MAPS_API_KEY/);
});
