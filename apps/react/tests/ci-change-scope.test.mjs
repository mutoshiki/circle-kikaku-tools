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

test('copy-only component changes and their browser coverage select tests from the diff', () => {
  const plan = classifyCiChanges([
    'apps/react/src/components/Allocation.jsx',
    'apps/react/tests/browser/allocation.spec.js',
    'apps/react/tests/browser/carbon-remediation.spec.js',
  ], {
    patches: new Map([
      ['apps/react/src/components/Allocation.jsx', "@@ -132 +132 @@\n-        <OverflowMenuItem itemText={record.locked ? 'ランダム割り当ての固定を解除' : 'ランダム割り当てで固定'} onClick={() => execute('editParticipant', { id, changes: { locked: !record.locked } })} />\n+        <OverflowMenuItem itemText={record.locked ? '固定を解除' : '配置を固定'} onClick={() => execute('editParticipant', { id, changes: { locked: !record.locked } })} />"],
    ]),
    availableBrowserSpecs: ['tests/browser/allocation.spec.js', 'tests/browser/carbon-remediation.spec.js'],
  });
  assert.equal(plan.profile, 'react-copy');
  assert.deepEqual(plan.browserSpecs, ['tests/browser/production-smoke.spec.js', 'tests/browser/allocation.spec.js', 'tests/browser/carbon-remediation.spec.js']);
  assert.equal(plan.needsFirebase, false);
  assert.equal(plan.needsLegacy, false);
  assert.equal(plan.needsVisual, false);
});

test('component structure changes select focused browser specs plus visual coverage', () => {
  const plan = classifyCiChanges(['apps/react/src/components/Panel.jsx'], {
    patches: new Map([['apps/react/src/components/Panel.jsx', '@@ -10,0 +11 @@\n+      <section className="panel-content">']]),
    availableBrowserSpecs: ['tests/browser/panel.spec.js'],
  });
  assert.equal(plan.profile, 'react-ui');
  assert.deepEqual(plan.browserSpecs, ['tests/browser/production-smoke.spec.js', 'tests/browser/panel.spec.js']);
  assert.equal(plan.needsVisual, true);
  assert.equal(plan.needsFirebase, false);
});

test('behavior changes in components fail closed to full checks', () => {
  const plan = classifyCiChanges(['apps/react/src/components/Panel.jsx'], {
    patches: new Map([['apps/react/src/components/Panel.jsx', '@@ -10 +10 @@\\n-    onClick={saveDraft}\\n+    onClick={publishDraft}']]),
    availableBrowserSpecs: ['tests/browser/panel.spec.js'],
  });
  assert.equal(plan.profile, 'full');
  assert.equal(plan.needsFirebase, true);
});

test('event handlers embedded in otherwise presentational tags fail closed', () => {
  const plan = classifyCiChanges(['apps/react/src/components/Panel.jsx'], {
    patches: new Map([['apps/react/src/components/Panel.jsx', '@@ -10,0 +11 @@\n+      <Button onClick={publishDraft}>公開</Button>']]),
    availableBrowserSpecs: ['tests/browser/panel.spec.js'],
  });
  assert.equal(plan.profile, 'full');
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

test('unknown paths fail closed and related specs are selected by filename', () => {
  const unknown = classifyCiChanges(['unclassified/behavior.js', 'apps/react/src/components/InitialEmptyState.jsx']);
  assert.equal(unknown.profile, 'full');
  assert.equal(unknown.needsFirebase, true);
  assert.equal(unknown.needsLegacy, true);
  assert.match(unknown.reasons.join(' '), /unknown/i);

  const mixed = classifyCiChanges(['apps/react/tests/browser/project-navigation.spec.js'], {
    patches: new Map([['apps/react/tests/browser/project-navigation.spec.js', '@@ -1 +1 @@\\n-test old\\n+test new']]),
    availableBrowserSpecs: ['tests/browser/project-navigation.spec.js'],
  });
  assert.equal(mixed.profile, 'react-targeted');
  assert.deepEqual(mixed.browserSpecs, ['tests/browser/production-smoke.spec.js', 'tests/browser/project-navigation.spec.js']);
  assert.equal(mixed.needsFirebase, false);
});

test('components without discoverable browser coverage fail closed to full checks', () => {
  const plan = classifyCiChanges(['apps/react/src/components/Uncovered.jsx'], {
    patches: new Map([['apps/react/src/components/Uncovered.jsx', '@@ -1 +1 @@\\n-<p>Old</p>\\n+<p>New</p>']]),
  });
  assert.equal(plan.profile, 'full');
  assert.equal(plan.needsFirebase, true);
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
