const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const entry = fs.readFileSync(path.join(root, 'assets/js/carbon-entry.js'), 'utf8');
const sheetTemplates = fs.readFileSync(path.join(root, 'assets/js/templates/sheet-templates.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function collectJsFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(item => {
    const full = path.join(directory, item.name);
    return item.isDirectory() ? collectJsFiles(full) : (item.name.endsWith('.js') ? [full] : []);
  });
}

const jsFiles = collectJsFiles(path.join(root, 'assets/js'));
const uiSource = [html, ...jsFiles.map(file => fs.readFileSync(file, 'utf8'))].join('\n');
const faReferences = uiSource.match(/\bfa-(?!solid\b)[a-z0-9-]+\b/g) || [];

assert(faReferences.length <= 112, `Phase 2B Font Awesome migrations must not regress above 112 references, found ${faReferences.length}`);
assert((html.match(/<cds-(?:icon-)?button\b/g) || []).length === 5, 'index.html must contain five official Carbon buttons after Phase 2B');
assert((sheetTemplates.match(/<cds-button\b/g) || []).length === 1, 'shared empty state must add one official Carbon button');

const staticIconContracts = [
  ['userGuideBtn', 'help'],
  ['historyBtn', 'recently-viewed'],
  ['planningCheckBtn', 'task'],
  ['sampleDataBtn', 'magic-wand'],
  ['resetDataBtn', 'trash-can']
];
staticIconContracts.forEach(([id, icon]) => {
  assert(new RegExp(`<button[^>]+id="${id}"[^>]*>[^<]*<span[^>]+data-carbon-icon="${icon}"`).test(html), `${id} must use Carbon ${icon}`);
});

['copy', 'help', 'magic-wand', 'recently-viewed', 'task', 'touch--1', 'trash-can'].forEach(icon => {
  assert(entry.includes(`@carbon/icons/es/${icon}/20.js`), `Carbon ${icon} definition must be bundled`);
});
assert(/<cds-button[^>]+id="overviewTimetableCopyBtn"[^>]+type="button"/.test(html), 'overview copy must be an official non-submit Carbon Button');
assert(/<cds-button(?=[^>]+data-action="switch-list")(?=[^>]+type="button")[^>]*>/.test(sheetTemplates), 'shared empty action must preserve switch-list and type=button');
assert(html.includes('data-carbon-icon="table" class="sheet-title-icon"'), 'shared title must use Carbon table');
assert(html.includes('data-carbon-icon="touch--1" class="me-1"'), 'shared gesture hint must use Carbon touch--1');
assert(!html.includes('fa-clock-rotate-left') && !html.includes('fa-table-list') && !html.includes('fa-hand-pointer'), 'migrated unique Font Awesome icons must be absent');

const bootstrapContracts = [
  ['data-bs-toggle', 2],
  ['data-bs-dismiss', 15],
  ['bootstrap.Modal', 12],
  ['hide.bs.modal', 2],
  ['hidden.bs.modal', 8]
];
bootstrapContracts.forEach(([token, expected]) => {
  const count = uiSource.split(token).length - 1;
  assert(count === expected, `${token} baseline changed: expected ${expected}, found ${count}`);
});

console.log('Carbon Phase 2B static contract check OK');
