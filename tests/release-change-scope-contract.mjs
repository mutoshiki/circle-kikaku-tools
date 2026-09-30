import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const classifier = fileURLToPath(new URL('../tools/classify-release-changes.mjs', import.meta.url));
const draft = 'apps/react/src/services/overview-draft.js';

function classify(paths, transition) {
  const fixture = mkdtempSync(join(tmpdir(), 'sanpo-release-scope-'));
  const git = (...args) => execFileSync('git', args, { cwd: fixture, encoding: 'utf8' }).trim();
  const put = path => {
    mkdirSync(dirname(join(fixture, path)), { recursive: true });
    writeFileSync(join(fixture, path), 'fixture\n');
  };
  try {
    git('init', '--quiet');
    git('config', 'user.email', 'scope-test@example.invalid');
    git('config', 'user.name', 'Scope contract fixture');
    git('config', 'commit.gpgsign', 'false');
    git('config', 'core.autocrlf', 'false');
    if (transition) {
      put(transition.from);
      git('add', '.');
    }
    git('commit', '--quiet', '--allow-empty', '-m', 'base');
    const base = git('rev-parse', 'HEAD');
    if (transition?.to) {
      mkdirSync(dirname(join(fixture, transition.to)), { recursive: true });
      renameSync(join(fixture, transition.from), join(fixture, transition.to));
    } else if (transition) rmSync(join(fixture, transition.from));
    for (const path of paths) put(path);
    git('add', '-A');
    git('commit', '--quiet', '--allow-empty', '-m', 'head');
    const outputFile = join(fixture, 'github-output');
    writeFileSync(outputFile, 'existing=value\n');
    const result = JSON.parse(execFileSync(process.execPath, [classifier, base, 'HEAD'], {
      cwd: fixture, encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: outputFile },
    }));
    return { result, output: readFileSync(outputFile, 'utf8') };
  } finally {
    // Remove only the unique temporary repository created by this test.
    rmSync(fixture, { recursive: true, force: true });
  }
}

test('local Overview draft runs React gates without claiming shared-domain changes', () => {
  const { result, output } = classify([draft]);
  assert.deepEqual(result, {
    react: true, shared: false, legacy: false, infrastructure: false,
    reactChecks: true, legacyChecks: false, changedPaths: [draft],
  });
  assert.equal(output, 'existing=value\nreact=true\nshared=false\nlegacy=false\nsource_legacy=false\ninfrastructure=false\n');
});

test('unknown services and every protected owner still require shared compatibility', () => {
  for (const path of [
    'apps/react/src/services/unknown.js',
    'apps/react/src/services/overview-draft-sync.js',
    'apps/react/src/services/nested/overview-draft.js',
    'apps/react/src/services/overview-draft.js/adapter.js',
    'apps/react/src/services/settlement-draft.js',
    'apps/react/src/domain/overview-draft.js',
    'apps/react/src/store/room-store.js',
    'apps/react/src/sync/runtime.js',
    'firebase/rules.json', 'firebase.json', 'types/room.ts',
    'assets/js/core/runtime.js',
    'assets/js/features/auto-assign.js',
    'assets/js/features/assignment-workspace.js',
    'assets/js/features/settlement/calculation.js',
    'assets/js/features/application-sync-bridge.js',
    'assets/js/features/form-applicant-sync-v2.js',
    'assets/js/features/google-form-import-parser.js',
    'assets/js/features/sheet/00-data-sync.js',
    'assets/js/modules/settlement.js',
    'assets/js/templates/settlement.js',
  ]) {
    const { result, output } = classify([path]);
    assert.equal(result.shared, true, path);
    assert.equal(result.reactChecks, true, path);
    assert.equal(result.legacyChecks, true, path);
    assert.match(output, /\nshared=true\n/, path);
  }
});

test('mixed UI draft and sync changes cannot bypass the shared gate', () => {
  const { result } = classify([draft, 'apps/react/src/sync/runtime.js']);
  assert.equal(result.shared, true);
  assert.equal(result.legacyChecks, true);
});

test('deleting or moving a protected service into UI retains its old shared ownership', () => {
  const from = 'apps/react/src/services/shared-runtime.js';
  for (const to of [undefined, 'apps/react/src/ui/runtime.js', draft]) {
    const { result } = classify([], { from, to });
    assert.equal(result.shared, true, `protected owner moved to ${to ?? 'deleted'}`);
    assert.ok(result.changedPaths.includes(from));
  }
});

test('CI tools and tests still run legacy baseline comparisons without being legacy product source', () => {
  const { result, output } = classify([draft, 'tools/classify-release-changes.mjs', 'tests/release-change-scope-contract.mjs']);
  assert.equal(result.shared, false);
  assert.equal(result.reactChecks, true);
  assert.equal(result.legacyChecks, true);
  assert.match(output, /\nsource_legacy=false\n/);
});

test('legacy product source still requires the clean legacy gate', () => {
  for (const path of ['index.html', 'assets/js/ui.js', 'tools/legacy-helper.js', 'apps-script/import.js']) {
    const { result, output } = classify([path]);
    assert.equal(result.legacyChecks, true, path);
    assert.match(output, /\nsource_legacy=true\n/, path);
  }
});

test('workflow and dependencies still require React and legacy infrastructure gates', () => {
  for (const path of ['.github/workflows/quality-guard.yml', 'package.json', 'package-lock.json', 'apps/react/package.json', 'apps/react/playwright.config.js', 'apps/react/vite.config.js']) {
    const { result } = classify([path]);
    assert.equal(result.infrastructure, true, path);
    assert.equal(result.reactChecks, true, path);
    assert.equal(result.legacyChecks, true, path);
  }
});

test('documentation-only changes do not require application gates', () => {
  const { result } = classify(['docs/design/README.md']);
  assert.equal(result.reactChecks, false);
  assert.equal(result.legacyChecks, false);
});
