import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { classifyCiChanges, collectChangedPaths } from '../../../tools/classify-release-changes.mjs';

const workflow = readFileSync(fileURLToPath(new URL('../../../.github/workflows/quality-guard.yml', import.meta.url)), 'utf8');

test('documentation-only changes produce an explicit no-tests plan', () => {
  const plan = classifyCiChanges(['docs/development/verification-and-release.md']);
  assert.equal(plan.profile, 'docs');
  assert.equal(plan.reactChecks, false);
  assert.equal(plan.legacyChecks, false);
  assert.equal(plan.needsFirebase, false);
  assert.equal(plan.reasons.length, 1);
});

test('approved leaf UI changes select their critical and matching browser specs only', () => {
  const plan = classifyCiChanges(['apps/react/src/components/InitialEmptyState.jsx']);
  assert.equal(plan.profile, 'react-leaf');
  assert.deepEqual(plan.browserSpecs, [
    'tests/browser/production-smoke.spec.js',
    'tests/browser/initial-empty-state.spec.js',
  ]);
  assert.equal(plan.needsFirebase, false);
  assert.equal(plan.needsLegacy, false);
  assert.equal(plan.needsVisual, false);
});

test('renames include both paths and broaden the selected checks', () => {
  const paths = collectChangedPaths('R100\tapps/react/src/components/InitialEmptyState.jsx\tapps/react/src/App.jsx');
  assert.deepEqual(paths, ['apps/react/src/components/InitialEmptyState.jsx', 'apps/react/src/App.jsx']);
  const plan = classifyCiChanges(paths);
  assert.equal(plan.profile, 'full');
  assert.equal(plan.needsFirebase, true);
});

test('global UI and shared service changes remain on broad compatibility checks', () => {
  const globalUi = classifyCiChanges(['apps/react/src/styles.scss']);
  assert.equal(globalUi.profile, 'full');
  assert.equal(globalUi.needsVisual, true);
  assert.equal(globalUi.needsFirebase, true);

  const shared = classifyCiChanges(['apps/react/src/services/form-maker-workspace.js']);
  assert.equal(shared.profile, 'full');
  assert.equal(shared.shared, true);
  assert.equal(shared.needsFirebase, true);
  assert.equal(shared.needsLegacy, true);
});

test('unknown paths fail closed and mixed leaf changes union their required specs', () => {
  const unknown = classifyCiChanges(['unclassified/behavior.js', 'apps/react/src/components/InitialEmptyState.jsx']);
  assert.equal(unknown.profile, 'full');
  assert.equal(unknown.needsFirebase, true);
  assert.equal(unknown.needsLegacy, true);
  assert.match(unknown.reasons.join(' '), /unknown/i);

  const mixed = classifyCiChanges([
    'docs/notes.md',
    'apps/react/src/components/InitialEmptyState.jsx',
    'apps/react/src/components/ui/SectionHeading.jsx',
  ]);
  assert.equal(mixed.profile, 'react-leaf');
  assert.deepEqual(mixed.browserSpecs, [
    'tests/browser/production-smoke.spec.js',
    'tests/browser/initial-empty-state.spec.js',
  ]);
  assert.deepEqual(mixed.visualSpecs, ['tests/browser/visual-consistency.spec.js']);
  assert.equal(mixed.needsVisual, true);
});

test('legacy baseline comparison runs only after a failed head run', () => {
  for (const [job, step] of [
    ['legacy-static', 'Run each static contract and retain its result'],
    ['legacy-browser', 'Run legacy browser suite against PR head'],
    ['legacy-collaboration', 'Run legacy collaboration simulations on PR head'],
  ]) {
    const start = workflow.indexOf(`  ${job}:`);
    const relativeNext = workflow.slice(start + 1).search(/\n  [a-z][a-z-]+:\n/);
    const next = relativeNext < 0 ? -1 : start + 1 + relativeNext;
    const body = workflow.slice(start, next < 0 ? undefined : next);
    assert.match(body, new RegExp(`- name: ${step.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\r?\\n        id: head`));
    assert.match(body, /if: steps\.head\.outcome != 'success'/);
  }
});
