import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = path => readFile(join(root, path), 'utf8');

const index = await read('index.html');
const headerEvents = await read('assets/js/features/events/02-static-header-events.js');
const appEvents = await read('assets/js/features/events.js');
const headerCss = await read('assets/css/app-shell/header/01-header-base.css');
const roomCss = await read('assets/css/app-shell/header/02-room-status.css');
const importShellCss = await read('assets/css/guides-modals/import-guide/01-import-shell.css');
const batchHelpCss = await read('assets/css/guides-modals/import-guide/05-batch-help-flow.css');
const buildScript = await read('tools/build-carbon-assets.mjs');

for (const required of [
  '<cds-header id="app-header"',
  '<cds-header-menu-button id="overviewMenuBtn"',
  '<cds-header-name href="./">サークル企画ツール</cds-header-name>',
  '<cds-side-nav id="overviewDrawer"',
  '<cds-side-nav-link id="bugReportMenuItem"',
  '<cds-text-input id="roomNameInput"',
  '<cds-accordion id="batchImportHelpAccordion"',
  '<cds-table class="batch-auto-rule-table"',
  './assets/vendor/carbon/ui-shell.min.js'
]) {
  assert.ok(index.includes(required), `index.html must use official Carbon component: ${required}`);
}

for (const forbidden of [
  '<header id="app-header">',
  '<aside id="overviewDrawer"',
  'overviewDrawerScrim',
  '<details class="batch-import-help-details"',
  '<table class="batch-auto-rule-table"'
]) {
  assert.ok(!index.includes(forbidden), `legacy static UI must not remain: ${forbidden}`);
}

for (const forbidden of [
  'createProjectTitleEditor',
  "setAttribute('contenteditable'",
  'createAppNavigationDrawer',
  "document.createElement('a')",
  'app-nav-drawer',
  'app-nav-link'
]) {
  assert.ok(!headerEvents.includes(forbidden), `header owner must not recreate Carbon UI: ${forbidden}`);
}
assert.ok(!appEvents.includes("document.createElement('a')"), 'app startup must not recreate side-nav links with native anchors');

for (const [name, source, forbidden] of [
  ['header CSS', headerCss, '.app-nav-drawer'],
  ['header CSS', headerCss, '.app-nav-link'],
  ['room CSS', roomCss, '.project-title-editor'],
  ['batch shell CSS', importShellCss, '.batch-import-help-details > summary'],
  ['batch help CSS', batchHelpCss, '.batch-auto-rule-table th'],
  ['batch help CSS', batchHelpCss, '.batch-auto-rule-table td']
]) {
  assert.ok(!source.includes(forbidden), `${name} must not restyle a legacy replacement: ${forbidden}`);
}

assert.ok(buildScript.includes("assets/js/carbon-ui-shell-entry.js"), 'build must own the UI Shell entry');
assert.ok(buildScript.includes("assets/vendor/carbon/ui-shell.min.js"), 'build must self-host the UI Shell bundle');

async function collectSourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collectSourceFiles(path));
    else if (['.js', '.mjs', '.html'].includes(extname(entry.name))) files.push(path);
  }
  return files;
}

const scannedFiles = [join(root, 'index.html'), ...await collectSourceFiles(join(root, 'assets', 'js'))]
  .filter(path => !path.includes(`${join('assets', 'vendor')}`));
const nativeControlPatterns = [
  /document\.createElement\(\s*['"]button['"]\s*\)/,
  /document\.createElement\(\s*['"]input['"]\s*\)/,
  /document\.createElement\(\s*['"]select['"]\s*\)/,
  /document\.createElement\(\s*['"]textarea['"]\s*\)/,
  /setAttribute\(\s*['"]contenteditable['"]/,
  /<button\b/i,
  /<input\b/i,
  /<select\b/i,
  /<textarea\b/i
];
const violations = [];
for (const file of scannedFiles) {
  const source = await readFile(file, 'utf8');
  for (const pattern of nativeControlPatterns) {
    if (pattern.test(source)) violations.push(`${relative(root, file)}: ${pattern}`);
  }
}
assert.deepEqual(violations, [], `generic native controls must use Carbon components:\n${violations.join('\n')}`);

console.log('Official Carbon ownership contract passed.');
