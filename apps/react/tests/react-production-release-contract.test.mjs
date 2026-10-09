import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync(new URL('../../../.github/workflows/react-production-release.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const ciWorkflow = readFileSync(new URL('../../../.github/workflows/quality-guard.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const smoke = readFileSync(new URL('./production/production-smoke.spec.js', import.meta.url), 'utf8');
const offlineSettlement = readFileSync(new URL('./browser/settlement.spec.js', import.meta.url), 'utf8');
const sharedSmokeActions = readFileSync(new URL('./browser/settlement-smoke-actions.mjs', import.meta.url), 'utf8');
const roomHelper = readFileSync(new URL('./production/firebase-smoke-room.mjs', import.meta.url), 'utf8');
const cleanup = readFileSync(new URL('../tools/cleanup-production-smoke.mjs', import.meta.url), 'utf8');
const repositoryRules = readFileSync(new URL('../../../AGENTS.md', import.meta.url), 'utf8');

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

  for (const name of ['release-gate', 'prepare', 'promotion', 'archive-successful-release', 'rollback']) {
    assert.match(job(name), /if:\s*github\.ref == 'refs\/heads\/main'/, `${name} is main-only`);
  }

  assert.match(job('prepare'), /needs:\s*release-gate/);
  assert.match(job('promotion'), /needs:\s*\[prepare\]/);
  assert.match(job('promotion'), /permissions:\s*\n\s+actions:\s+read\n\s+contents:\s+read\n\s+pages:\s+write\n\s+id-token:\s+write/);
  const prepare = job('prepare');
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
  assert.match(promotion, /id: root-deployment\s+if: always\(\) && needs\.prepare\.result == 'success' && \(needs\.prepare\.outputs\.release_mode == 'standard' \|\| \(needs\.prepare\.outputs\.release_mode == 'migration' && steps\.compatibility-smoke\.outcome == 'success' && steps\.compatibility-cleanup\.outcome == 'success'\)\)/);
  assert.match(job('cleanup-recovery'), /if: always\(\) && needs\.prepare\.result == 'success' && needs\.promotion\.result != 'success'/);
  assert.match(job('cleanup-recovery'), /needs:\s*\[prepare, promotion\]/);
  assert.match(job('rollback'), /needs:\s*\[prepare, promotion, cleanup-recovery, archive-successful-release\]/);
  assert.match(job('rollback'), /needs\.promotion\.outputs\.root_deployment_outcome == 'failure' \|\|/);
  assert.match(job('prepare'), /Build React app once for both deployment paths/);
  assert.match(job('prepare'), /production-release-artifact\.mjs digest "\$RUNNER_TEMP\/react-root"/);
  const rootAssemblyStart = prepare.indexOf('      - name: Assemble root React artifact');
  const rootAssemblyEnd = prepare.indexOf('      - name: Upload root React artifact', rootAssemblyStart);
  const rootAssembly = prepare.slice(rootAssemblyStart, rootAssemblyEnd);
  assert.match(rootAssembly, /mkdir -p "\$RUNNER_TEMP\/react-root\/react" "\$RUNNER_TEMP\/react-root\/legacy"/);
  assert.match(rootAssembly, /cp -a apps\/react\/dist\/\. "\$RUNNER_TEMP\/react-root\/react\/"/);
  assert.match(rootAssembly, /cp rollback-source\/index\.html rollback-source\/firebase-config\.js rollback-source\/maps-config\.js rollback-source\/ogp-thumbnail\.png "\$RUNNER_TEMP\/react-root\/legacy\/"/);
  assert.match(rootAssembly, /production-release-artifact\.mjs digest "\$RUNNER_TEMP\/react-root"/);
  assert.match(rootAssembly, /release-build\.json/);
  assert.match(rootAssembly, /root\/react\/release-build\.json/);
  assert.match(prepare, /name: github-pages-react-root-release-payload[\s\S]*?path: \$\{\{ runner\.temp \}\}\/react-root/);
  const durablePayloadUploadStart = prepare.indexOf('      - name: Keep run-scoped payload for successful release archive');
  const durablePayloadUploadEnd = prepare.indexOf('      - name: Assemble pinned legacy rollback artifact', durablePayloadUploadStart);
  assert.match(prepare.slice(durablePayloadUploadStart, durablePayloadUploadEnd), /include-hidden-files:\s*true/);
  assert.match(job('prepare'), /fetch-depth:\s*0/);
  assert.match(job('prepare'), /classify-production-release\.mjs/);
  assert.match(job('prepare'), /release_mode:\s*\$\{\{ steps\.release-classification\.outputs\.mode \}\}/);
  assert.match(promotion, /needs\.prepare\.outputs\.release_mode == 'standard'/);
  assert.match(promotion, /needs\.prepare\.outputs\.release_mode == 'migration'/);
  assert.match(promotion, /id: compatibility-deployment\s+if: needs\.prepare\.outputs\.release_mode == 'migration'/);
  assert.match(prepare, /Build migration artifact with stable root, \/react\/, and \/legacy\//);
  assert.match(prepare, /cp rollback-source\/index\.html rollback-source\/firebase-config\.js rollback-source\/maps-config\.js rollback-source\/ogp-thumbnail\.png _site\/legacy\//);
  assert.match(prepare, /cp -a rollback-source\/assets _site\/legacy\//);
  assert.match(prepare, /cp -a apps\/react\/dist\/\. _site\/react\//);
  assert.match(prepare, /cp -a "\$RUNNER_TEMP\/react-rollback\/\." _site\//);
  assert.match(repositoryRules, /React UI component・style・public UI assetだけ/);
  assert.match(repositoryRules, /旧legacyは `\/legacy\/`、移行対象Reactは `\/react\/`/);

  for (const browser of ['Chromium', 'WebKit', 'visual and layout']) {
    assert.match(ciWorkflow, new RegExp(`Require every React ${browser} test to pass on the PR head`));
  }
  assert.doesNotMatch(ciWorkflow, /Run the same React .* suite on exact PR base/);
});

test('production Firebase smoke uses browser-origin auth and keeps its room marker guard', () => {
  assert.match(smoke, /const baseURL = process\.env\.REACT_PRODUCTION_SMOKE_BASE_URL/);
  assert.match(smoke, /seedProductionSmokeRoom\(page/);
  assert.match(smoke, /cleanupProductionSmokeRoom\(cleanupPage/);
  assert.match(smoke, /openRoutePlannerFromMovementSettings/);
  assert.match(offlineSettlement, /openRoutePlannerFromMovementSettings/);
  assert.match(sharedSmokeActions, /移動距離計算ツール/);
  assert.match(sharedSmokeActions, /returnToMovementSettingsFromRoutePlanner/);
  assert.match(smoke, /new URL\('\/circle-kikaku-tools\/legacy\//);
  assert.match(smoke, /if \(mode === 'root'\)[\s\S]*?circle-kikaku-tools\/react\/[\s\S]*?circle-kikaku-tools\/legacy\//);
  assert.match(smoke, /if \(!page\.isClosed\(\)\) await page\.close\(\)/);
  assert.doesNotMatch(smoke, /signInAnonymously|initializeApp\(config/);
  assert.match(roomHelper, /referrerPolicy: 'origin'/);
  assert.match(roomHelper, /existingMarker !== marker/);
  assert.match(roomHelper, /Reserved smoke room contains unmarked data; no data was changed/);
  assert.match(cleanup, /chromium\.launch/);
  assert.match(smoke, /expect\.poll\([\s\S]*?Build identity manifest request failed/);
  assert.match(smoke, /cache:\s*'no-store'/);
  assert.match(smoke, /timeout:\s*120_000/);
  assert.match(smoke, /await waitForProductionBuildManifest\(page\);[\s\S]*?await page\.reload\(\)/);
  assert.match(smoke, /const consoleErrors = \[\]/);
  assert.match(smoke, /Unexpected browser console\/page errors/);
  assert.match(smoke, /const identityToolkitDiagnostics = \[\]/);
  assert.match(smoke, /request\.failure\(\)\?\.errorText/);
  assert.match(smoke, /identitytoolkit\.googleapis\.com/);
  assert.match(smoke, /response\.status\(\) >= 400/);
  assert.match(smoke, /\$\{url\.origin\}\$\{url\.pathname\}/);
  assert.match(smoke, /message\.text\(\)\.replace/);
  assert.match(smoke, /Identity Toolkit request diagnostics/);
  for (const name of ['prepare', 'promotion', 'cleanup-recovery']) assert.match(job(name), /secrets\.REACT_FIREBASE_API_KEY/);
  assert.match(job('prepare'), /secrets\.REACT_MAPS_API_KEY/);
});

test('rollback uses the current verified React release and only saves a smoke-verified payload', () => {
  const prepare = job('prepare');
  const archive = job('archive-successful-release');
  const rollback = job('rollback');
  const promotion = job('promotion');
  assert.match(prepare, /fetch-current/);
  assert.match(prepare, /Require exact current React rollback before deploying over its root/);
  assert.match(prepare, /steps\.rollback-payload\.outputs\.published_sha != '' && steps\.rollback-payload\.outputs\.source == 'pinned-legacy-fallback'/);
  assert.match(prepare, /github-pages-react-rollback/);
  assert.match(prepare, /github-pages-react-root-release-payload/);
  assert.match(archive, /needs:\s*\[prepare, promotion\]/);
  assert.match(archive, /needs\.promotion\.result == 'success'/);
  assert.match(archive, /contents:\s*write/);
  assert.match(archive, /production-release-artifact\.mjs publish/);
  assert.match(readFileSync(new URL('../tools/production-release-artifact.mjs', import.meta.url), 'utf8'), /'--latest=false'/);
  assert.doesNotMatch(prepare, /contents:\s*write/);
  assert.match(rollback, /github-pages-react-rollback/);
  assert.match(rollback, /needs\.archive-successful-release\.result == 'failure'/);
  assert.match(rollback, /needs:\s*\[prepare, promotion, cleanup-recovery, archive-successful-release\]/);
  const summary = job('release-summary');
  assert.match(summary, /needs:\s*\[release-gate, prepare, promotion, cleanup-recovery, archive-successful-release, rollback\]/);
  assert.match(summary, /READINESS_SECONDS/);
  assert.match(job('release-gate'), /readiness_completed_at:\s*\$\{\{ steps\.readiness\.outputs\.completed_at_epoch \}\}/);
  assert.match(job('release-gate'), /readiness_completed_at=\$\(date -u -d "\$completed" \+%s\)/);
  assert.match(summary, /READINESS_COMPLETED_AT:\s*\$\{\{ needs\.release-gate\.outputs\.readiness_completed_at \}\}/);
  assert.match(summary, /Readiness success to release completion: %s seconds/);
  assert.match(summary, /PREPARE_SECONDS/);
  assert.match(summary, /PROMOTION_SECONDS/);
  assert.match(summary, /Root deploy \/ smoke \/ cleanup/);
  assert.match(job('prepare'), /prepare_seconds:\s*\$\{\{ steps\.prepare-summary\.outputs\.duration_seconds \}\}/);
  assert.match(promotion, /promotion_seconds:\s*\$\{\{ steps\.promotion-summary\.outputs\.duration_seconds \}\}/);
});
