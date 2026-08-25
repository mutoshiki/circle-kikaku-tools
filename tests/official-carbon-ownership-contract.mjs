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
  'projectTitleEditor',
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
assert.ok(!appEvents.includes("document.createElement('cds-side-nav-link')"), 'static navigation must remain static instead of being recreated at runtime');

// Project title is the deliberate visual exception: keep the Carbon text input as the
// persistence owner, while restoring the original large inline page-title editor exactly.
assert.match(appEvents, /editor\.id = 'projectTitleEditor'/);
assert.match(appEvents, /editor\.setAttribute\('contenteditable', 'plaintext-only'\)/);
assert.match(appEvents, /roomInput\.dispatchEvent\(new Event\('input'/);
assert.match(appEvents, /installProjectTitleValueBridge/);
assert.match(roomCss, /\.project-title-editor[\s\S]*font-size:\s*3\.375rem/);
assert.match(roomCss, /max-width:\s*768px[\s\S]*font-size:\s*2\.625rem/);
assert.match(roomCss, /\.project-title-editor:empty::before[\s\S]*#8d8d8d/);
assert.match(roomCss, /\.app-room-field,[\s\S]*clip-path:\s*inset\(50%\)/);

// The official HeaderMenuButton and SideNav remain the navigation components. Their
// controlled bridge follows Carbon's toggle event, and viewport placement is explicit so
// expanded can never mean off-canvas.
assert.match(appEvents, /function setCarbonSideNavExpanded\(expanded/);
assert.match(appEvents, /drawer\.expanded = next;/);
assert.match(appEvents, /drawer\.toggleAttribute\('expanded', next\);/);
assert.match(appEvents, /trigger\.active = next;/);
assert.match(appEvents, /trigger\.setAttribute\('aria-expanded', String\(next\)\);/);
assert.match(appEvents, /addEventListener\('cds-header-menu-button-toggled', event =>/);
assert.match(appEvents, /setCarbonSideNavExpanded\(Boolean\(event\.detail\?\.active\)\);/);
assert.match(appEvents, /setupCarbonSideNavigationState\(\);/);
assert.match(headerCss, /#overviewDrawer\s*\{[\s\S]*position:\s*fixed[\s\S]*visibility:\s*hidden[\s\S]*translateX\(-100%\)/);
assert.match(headerCss, /#overviewDrawer\[expanded\][\s\S]*visibility:\s*visible[\s\S]*translateX\(0\)/);

for (const [name, source, forbidden] of [
  ['header CSS', headerCss, '.app-nav-drawer'],
  ['header CSS', headerCss, '.app-nav-link'],
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
const forbiddenPatterns = [
  ['native button creation', /document\.createElement\(\s*['"]button['"]\s*\)/],
  ['native input creation', /document\.createElement\(\s*['"]input['"]\s*\)/],
  ['native select creation', /document\.createElement\(\s*['"]select['"]\s*\)/],
  ['native textarea creation', /document\.createElement\(\s*['"]textarea['"]\s*\)/],
  ['native button markup', /<button\b/i],
  ['native input markup', /<input\b/i],
  ['native select markup', /<select\b/i],
  ['native textarea markup', /<textarea\b/i],
  ['legacy custom app drawer', /app-nav-drawer/],
  ['legacy custom app nav link', /app-nav-link/]
];
const violations = [];
const contenteditableOwners = [];
for (const file of scannedFiles) {
  const source = await readFile(file, 'utf8');
  for (const [label, pattern] of forbiddenPatterns) {
    if (pattern.test(source)) violations.push(`${relative(root, file)}: ${label}`);
  }
  if (/setAttribute\(\s*['"]contenteditable['"]/.test(source)) contenteditableOwners.push(relative(root, file));
}
assert.deepEqual(violations, [], `official Carbon ownership violations:\n${violations.join('\n')}`);
assert.deepEqual(contenteditableOwners, ['assets/js/features/events.js'], 'only the restored project-title editor may use contenteditable');

console.log('Official Carbon ownership contract passed with the restored project-title visual exception.');