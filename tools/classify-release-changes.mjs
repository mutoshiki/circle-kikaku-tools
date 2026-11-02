import { appendFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const docsPath = path => /^(?:docs\/|\.superpowers\/)/.test(path) || /^[^/]+\.md$/i.test(path);
const sharedPath = path => /^(firebase\/|firebase\.json$|apps\/react\/src\/(domain|sync|store|services)\/|assets\/js\/(core\/|features\/(application-sync-bridge|form-applicant-sync-v2|settlement(?:\/|\.js$)|assignment-workspace\.js$|auto-assign\.js$|google-form-import-parser\.js$|sheet\/00-data-sync\.js$)|modules\/settlement\.js$|templates\/settlement(?:\/|\.js$))|types\/)/.test(path);
const legacyPath = path => /^(index\.html$|assets\/|apps-script\/|tests\/|tools\/|firebase-config\.js$|maps-config\.js$|playwright(?:\.webkit)?\.config\.js$)/.test(path);
const infrastructurePath = path => /^\.github\//.test(path)
  || /^(package(?:-lock)?\.json|pnpm(?:-lock)?\.yaml|stylelint\.config\.mjs|tsconfig\.maps\.json)$/.test(path)
  || /^apps\/react\/(package(?:-lock)?\.json|playwright[^/]*|vite\.config\.)/.test(path);
const reactPath = path => /^apps\/react\//.test(path);
const componentPath = path => /^apps\/react\/src\/components\/.+\.(?:jsx?|tsx?|scss|css)$/.test(path);
const browserSpecPath = path => /^apps\/react\/tests\/browser\/.+\.spec\.js$/.test(path);

export function collectChangedPaths(nameStatus) {
  const paths = [];
  for (const line of nameStatus.split(/\r?\n/).filter(Boolean)) {
    const [status, ...changed] = line.split('\t');
    if (status?.startsWith('R') || status?.startsWith('C')) paths.push(...changed.slice(0, 2));
    else if (changed[0]) paths.push(changed[0]);
  }
  return [...new Set(paths.map(path => path.replaceAll('\\', '/')))];
}

function changedLines(patch) {
  return patch.split(/\r?\n/).filter(line => (line.startsWith('+') && !line.startsWith('+++')) || (line.startsWith('-') && !line.startsWith('---')));
}

function normalizeCopyLine(line) {
  let body = line.slice(1).trim();
  if (!body) return ':blank';
  if (/^[^<>={}();=]+$/.test(body) && /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(body)) return ':jsx-text';

  const copyAttribute = /\b(itemText|aria-label|title|placeholder|label|helperText|description|assistiveText)\s*=\s*\{[^}]*\}|\b(aria-label|title|placeholder|label|helperText|description|assistiveText)\s*=\s*(?:"[^"]*"|'[^']*')/g;
  const normalized = body.replace(copyAttribute, (_match, expressionName, stringName) => `${expressionName || stringName}="<copy>"`);
  return normalized === body ? body : normalized;
}

function isCopyOnlyPatch(patch) {
  const lines = changedLines(patch);
  if (!lines.length) return false;
  const removed = lines.filter(line => line.startsWith('-')).map(normalizeCopyLine);
  const added = lines.filter(line => line.startsWith('+')).map(normalizeCopyLine);
  return removed.length === added.length && removed.length > 0 && removed.every((line, index) => line === added[index]);
}

function isStaticUiPatch(patch) {
  const lines = changedLines(patch).map(line => line.slice(1).trim()).filter(Boolean);
  if (!lines.length) return false;
  const staticTag = /^<\/?[A-Za-z][\w.-]*(?:\s+(?:className|class|id|role|title|placeholder|aria-[\w-]+|data-[\w-]+)=(?:"[^"]*"|'[^']*'))*\s*\/?>$/;
  return lines.every(line => (/^[^<>={}();=]+$/.test(line) && /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(line))
    || (staticTag.test(line) && !/\bon[A-Z]\w*\s*=|=>|\b(?:execute|runtime|set[A-Z]|use[A-Z])\b/.test(line)));
}

function matchedSpecs(paths, availableBrowserSpecs) {
  const known = new Set(availableBrowserSpecs);
  const selected = [];
  for (const path of paths) {
    if (browserSpecPath(path)) {
      const spec = path.replace(/^apps\/react\//, '');
      if (known.has(spec)) selected.push(spec);
      continue;
    }
    if (!componentPath(path) || !/\.(?:jsx?|tsx?)$/.test(path)) continue;
    const stem = path.slice(path.lastIndexOf('/') + 1).replace(/\.(?:jsx?|tsx?)$/, '').toLowerCase();
    const spec = `tests/browser/${stem}.spec.js`;
    if (known.has(spec)) selected.push(spec);
  }
  return [...new Set(selected)];
}

export function classifyCiChanges(inputPaths, { patches = new Map(), availableBrowserSpecs = [] } = {}) {
  const paths = [...new Set(inputPaths.map(path => String(typeof path === 'string' ? path : path.path).replaceAll('\\', '/')))];
  const matches = pattern => paths.some(path => pattern.test(path));
  const react = paths.some(reactPath);
  const shared = paths.some(sharedPath);
  const legacy = paths.some(legacyPath);
  const legacySource = matches(/^(index\.html$|assets\/|apps-script\/|tools\/[^/]+\.js$|firebase-config\.js$|maps-config\.js$)/);
  const infrastructure = paths.some(infrastructurePath);
  const docsOnly = paths.length > 0 && paths.every(docsPath);
  const emptyDiff = paths.length === 0;
  const unknownPaths = paths.filter(path => !docsPath(path) && !reactPath(path) && !sharedPath(path) && !legacyPath(path) && !infrastructurePath(path));
  const unknown = unknownPaths.length > 0 || emptyDiff;
  const componentPaths = paths.filter(componentPath);
  let browserSpecs = matchedSpecs(paths, availableBrowserSpecs);
  const sourcePaths = componentPaths.filter(path => /\.(?:jsx?|tsx?)$/.test(path));
  const allSourcePatchesKnown = sourcePaths.length > 0 && sourcePaths.every(path => patches.has(path));
  const copyOnly = allSourcePatchesKnown && sourcePaths.every(path => isCopyOnlyPatch(patches.get(path)));
  const staticUiOnly = allSourcePatchesKnown && sourcePaths.every(path => isStaticUiPatch(patches.get(path)));
  const componentOnly = paths.length > 0 && paths.every(path => docsPath(path) || componentPath(path) || browserSpecPath(path));
  const targeted = browserSpecs.length > 0;

  let profile = 'full';
  let reactChecks = react || shared || infrastructure;
  let legacyChecks = legacy || shared || infrastructure;
  let visualSpecs = [];
  const reasons = [];

  if (docsOnly) {
    profile = 'docs';
    reactChecks = false;
    legacyChecks = false;
    reasons.push('Documentation-only change; no application checks required');
  } else if (!unknown && !shared && !infrastructure && componentOnly && copyOnly && targeted) {
    profile = 'react-copy';
    reactChecks = true;
    legacyChecks = false;
    reasons.push('Diff changes only visible copy; run browser specs found by changed component/spec names');
  } else if (!unknown && !shared && !infrastructure && componentOnly && staticUiOnly && targeted) {
    profile = 'react-ui';
    reactChecks = true;
    legacyChecks = false;
    visualSpecs = ['tests/browser/visual-consistency.spec.js'];
    reasons.push('Diff changes static component structure or presentation; run related browser and visual checks');
  } else if (!unknown && !shared && !infrastructure && paths.length > 0 && paths.every(path => browserSpecPath(path) || docsPath(path)) && targeted) {
    profile = 'react-targeted';
    reactChecks = true;
    legacyChecks = false;
    reasons.push('Browser test changes select the corresponding specs directly');
  } else if (unknown) {
    reactChecks = true;
    legacyChecks = true;
    reasons.push(emptyDiff ? 'No changed paths were provided; use full verification' : `Unknown paths require full verification: ${unknownPaths.join(', ')}`);
  } else {
    reasons.push(shared ? 'Shared/domain/sync boundary changed' : infrastructure ? 'CI, dependency or build configuration changed' : 'Behavior or impact could not be safely narrowed from the diff');
  }

  if (profile === 'react-copy' || profile === 'react-ui' || profile === 'react-targeted') {
    browserSpecs.unshift('tests/browser/production-smoke.spec.js');
    browserSpecs = [...new Set(browserSpecs)];
  }
  const full = profile === 'full';
  const needsFirebase = full && (reactChecks || shared);
  const needsLegacy = full && legacyChecks;
  const needsVisual = reactChecks && (full || visualSpecs.length > 0);
  return {
    react,
    shared: shared || unknown,
    legacy,
    infrastructure: infrastructure || unknown,
    reactChecks,
    legacyChecks: needsLegacy,
    sourceLegacy: legacySource || unknown,
    needsFirebase,
    needsLegacy,
    needsVisual,
    profile,
    browserSpecs: full || profile === 'docs' ? [] : browserSpecs,
    visualSpecs,
    reasons,
    changedPaths: paths,
  };
}

function collectBrowserSpecs() {
  return readdirSync(new URL('../apps/react/tests/browser/', import.meta.url))
    .filter(file => file.endsWith('.spec.js'))
    .map(file => `tests/browser/${file}`);
}

function runCli() {
  const [base, head = 'HEAD'] = process.argv.slice(2);
  if (!base) throw new Error('Usage: node tools/classify-release-changes.mjs <base-sha> [head-sha]');
  const nameStatus = execFileSync('git', ['diff', '--name-status', '--find-renames', '--diff-filter=ACMRD', `${base}...${head}`], { encoding: 'utf8' });
  const paths = collectChangedPaths(nameStatus);
  const rawDiff = execFileSync('git', ['diff', '--no-ext-diff', '--unified=0', '--no-color', '--find-renames', `${base}...${head}`], { encoding: 'utf8' });
  const patches = new Map();
  let currentPath = null;
  for (const line of rawDiff.split(/\r?\n/)) {
    const header = line.match(/^diff --git a\/(.*) b\/(.*)$/);
    if (header) {
      currentPath = header[2].replaceAll('\\', '/');
      patches.set(currentPath, '');
    } else if (currentPath !== null) {
      patches.set(currentPath, `${patches.get(currentPath)}${line}\n`);
    }
  }
  const result = { ...classifyCiChanges(paths, { patches, availableBrowserSpecs: collectBrowserSpecs() }), base, head };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, [
      `react=${result.reactChecks}`,
      `shared=${result.shared}`,
      `legacy=${result.needsLegacy}`,
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
