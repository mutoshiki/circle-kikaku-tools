import { appendFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const verificationScope = JSON.parse(readFileSync(new URL('./verification-scope.json', import.meta.url), 'utf8'));
const docsPath = path => /^(?:docs\/|\.superpowers\/)/.test(path) || /^[^/]+\.md$/i.test(path);
const sharedPath = path => /^(firebase\/|firebase\.json$|apps\/react\/src\/(domain|sync|store|services)\/|assets\/js\/(core\/|features\/(application-sync-bridge|form-applicant-sync-v2|settlement(?:\/|\.js$)|assignment-workspace\.js$|auto-assign\.js$|google-form-import-parser\.js$|sheet\/00-data-sync\.js$)|modules\/settlement\.js$|templates\/settlement(?:\/|\.js$))|types\/)/.test(path);
const legacyPath = path => /^(index\.html$|assets\/|apps-script\/|tests\/|tools\/|firebase-config\.js$|maps-config\.js$|playwright(?:\.webkit)?\.config\.js$)/.test(path);
const infrastructurePath = path => /^\.github\//.test(path)
  || /^(package(?:-lock)?\.json|pnpm(?:-lock)?\.yaml|stylelint\.config\.mjs|tsconfig\.maps\.json)$/.test(path)
  || /^apps\/react\/(package(?:-lock)?\.json|playwright[^/]*|vite\.config\.)/.test(path);

export function collectChangedPaths(nameStatus) {
  const paths = [];
  for (const line of nameStatus.split(/\r?\n/).filter(Boolean)) {
    const [status, ...changed] = line.split('\t');
    if (status?.startsWith('R') || status?.startsWith('C')) paths.push(...changed.slice(0, 2));
    else if (changed[0]) paths.push(changed[0]);
  }
  return [...new Set(paths.map(path => path.replaceAll('\\', '/')))];
}

export function classifyCiChanges(inputPaths) {
  const paths = [...new Set(inputPaths.map(path => String(path).replaceAll('\\', '/')))];
  const matches = pattern => paths.some(path => pattern.test(path));
  const react = matches(/^apps\/react\//);
  const shared = paths.some(sharedPath);
  const legacy = paths.some(legacyPath);
  const legacySource = matches(/^(index\.html$|assets\/|apps-script\/|tools\/[^/]+\.js$|firebase-config\.js$|maps-config\.js$)/);
  const infrastructure = paths.some(infrastructurePath);
  let reactChecks = react || shared || infrastructure;
  let legacyChecks = legacy || shared || infrastructure;
  const docsOnly = paths.length > 0 && paths.every(docsPath);
  const leafEntries = paths.map(path => verificationScope.leafUi[path]);
  const leafOnly = paths.length > 0 && paths.every(path => docsPath(path) || Boolean(verificationScope.leafUi[path]))
    && paths.some(path => Boolean(verificationScope.leafUi[path]));
  const unknownPaths = paths.filter(path => !docsPath(path) && !/^apps\/react\//.test(path) && !sharedPath(path) && !legacyPath(path) && !infrastructurePath(path) && !verificationScope.leafUi[path]);
  const emptyDiff = paths.length === 0;
  const unknown = unknownPaths.length > 0 || emptyDiff;

  let profile = 'full';
  let browserSpecs = [];
  let visualSpecs = [];
  const reasons = [];
  if (docsOnly) {
    profile = 'docs';
    reactChecks = false;
    legacyChecks = false;
    reasons.push('Documentation-only change; no application checks required');
  } else if (leafOnly && !unknown) {
    profile = 'react-leaf';
    reactChecks = true;
    legacyChecks = false;
    browserSpecs = ['tests/browser/production-smoke.spec.js'];
    for (const entry of leafEntries.filter(Boolean)) {
      browserSpecs.push(...(entry.browserSpecs || []));
      visualSpecs.push(...(entry.visualSpecs || []));
      reasons.push(entry.reason);
    }
    browserSpecs = [...new Set(browserSpecs)];
    visualSpecs = [...new Set(visualSpecs)];
  } else if (unknown) {
    reactChecks = true;
    legacyChecks = true;
    reasons.push(emptyDiff ? 'No changed paths were provided; use full verification' : `Unknown paths require full verification: ${unknownPaths.join(', ')}`);
  } else {
    reasons.push(shared ? 'Shared/domain/sync boundary changed' : infrastructure ? 'CI, dependency or build configuration changed' : 'Change is outside the explicit leaf UI allowlist');
  }

  const needsFirebase = profile === 'full' && (reactChecks || shared);
  const needsLegacy = profile === 'full' && legacyChecks;
  const needsVisual = reactChecks && (profile === 'full' || visualSpecs.length > 0);
  const needsReact = reactChecks;
  return {
    react,
    shared: shared || unknown,
    legacy,
    infrastructure: infrastructure || unknown,
    reactChecks: needsReact,
    legacyChecks: needsLegacy,
    sourceLegacy: legacySource || unknown,
    needsFirebase,
    needsLegacy,
    needsVisual,
    profile,
    browserSpecs,
    visualSpecs,
    reasons,
    changedPaths: paths,
  };
}

function runCli() {
  const [base, head = 'HEAD'] = process.argv.slice(2);
  if (!base) throw new Error('Usage: node tools/classify-release-changes.mjs <base-sha> [head-sha]');
  const nameStatus = execFileSync('git', ['diff', '--name-status', '--find-renames', '--diff-filter=ACMRD', `${base}...${head}`], { encoding: 'utf8' });
  const paths = collectChangedPaths(nameStatus);
  const result = { ...classifyCiChanges(paths), base, head };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, [
      `react=${result.reactChecks}`,
      `shared=${result.shared}`,
      `legacy=${result.legacyChecks}`,
      `source_legacy=${result.sourceLegacy}`,
      `infrastructure=${result.infrastructure}`,
      `profile=${result.profile}`,
      `browser_specs=${result.browserSpecs.join(' ')}`,
      `visual_specs=${result.visualSpecs.join(' ')}`,
      `needs_firebase=${result.needsFirebase}`,
      `needs_legacy=${result.needsLegacy}`,
      `needs_visual=${result.needsVisual}`,
      `reasons=${result.reasons.join('; ')}`,
    ].join('\n') + '\n');
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `## Verification plan\n\n- Profile: \`${result.profile}\`\n- Base/head: \`${base}\` → \`${head}\`\n- Browser specs: ${result.browserSpecs.join(', ') || (result.needsVisual ? 'full suite' : 'none')}\n- Visual specs: ${result.visualSpecs.join(', ') || (result.needsVisual && result.profile === 'full' ? 'tests/browser/visual-consistency.spec.js' : 'none')}\n- Firebase: ${result.needsFirebase ? 'required' : 'not required'}; legacy: ${result.needsLegacy ? 'required' : 'not required'}\n- Reason: ${result.reasons.join('; ')}\n`);
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) runCli();
