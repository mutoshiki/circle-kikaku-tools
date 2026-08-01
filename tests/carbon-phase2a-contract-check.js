const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const entry = fs.readFileSync(path.join(root, 'assets/js/carbon-entry.js'), 'utf8');
const bundle = fs.readFileSync(path.join(root, 'assets/vendor/carbon/carbon-entry.min.js'), 'utf8');
const adapter = fs.readFileSync(path.join(root, 'assets/js/core/icon-adapter.js'), 'utf8');
const themeController = fs.readFileSync(path.join(root, 'assets/js/core/theme-controller.js'), 'utf8');
const lockProtection = fs.readFileSync(path.join(root, 'assets/js/features/lock-protection.js'), 'utf8');
const waitingTray = fs.readFileSync(path.join(root, 'assets/js/features/waiting-tray.js'), 'utf8');
const settlementRender = fs.readFileSync(path.join(root, 'assets/js/features/settlement/03-render.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function collectJsFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(item => {
    const full = path.join(directory, item.name);
    return item.isDirectory() ? collectJsFiles(full) : (item.name.endsWith('.js') ? [full] : []);
  });
}

const expectedVersions = {
  '@carbon/web-components': '2.60.0',
  '@carbon/icons': '11.85.0',
  '@ibm/plex-sans': '1.1.0',
  '@ibm/plex-sans-jp': '3.0.0'
};

Object.entries(expectedVersions).forEach(([name, version]) => {
  assert(pkg.devDependencies[name] === version, `${name} must stay pinned to ${version}`);
  assert(bundle.includes(version), `generated Carbon bundle must record ${name} ${version}`);
});

assert(entry.includes("@carbon/web-components/es/components/button/index.js"), 'official cds-button module must be imported');
assert(entry.includes("@carbon/web-components/es/components/icon-button/index.js"), 'official cds-icon-button module must be imported');
assert(entry.includes("@carbon/icons/es/"), 'official Carbon icon definitions must be imported');
assert(/<script type="module" src="\.\/assets\/vendor\/carbon\/carbon-entry\.min\.js\?v=2\.60\.0"><\/script>/.test(html), 'local Carbon module bundle must be loaded');
assert(html.includes('./assets/vendor/ibm-plex/plex.css'), 'local IBM Plex stylesheet must be loaded');

const migratedButtons = html.match(/<cds-(?:icon-)?button\b/g) || [];
assert(migratedButtons.length >= 4, `Phase 2A foundation must retain at least four migrated Carbon buttons, found ${migratedButtons.length}`);
['shareLinkBtn', 'overviewMenuBtn', 'overviewDrawerCloseBtn', 'overviewTimetableAddBtn'].forEach(id => {
  assert(new RegExp(`<cds-(?:icon-)?button[^>]+id="${id}"`).test(html), `${id} must use an official Carbon button`);
});

[
  'assets/vendor/carbon/LICENSE-web-components.txt',
  'assets/vendor/carbon/LICENSE-icons.txt',
  'assets/vendor/ibm-plex/plex.css',
  'assets/vendor/ibm-plex/LICENSE.txt',
  'assets/vendor/ibm-plex/LICENSE-jp.txt',
  'assets/vendor/ibm-plex/fonts/IBMPlexSans-Regular.woff2',
  'assets/vendor/ibm-plex/fonts/IBMPlexSans-SemiBold.woff2',
  'assets/vendor/ibm-plex/fonts/IBMPlexSansJP-Regular.woff2',
  'assets/vendor/ibm-plex/fonts/IBMPlexSansJP-SemiBold.woff2'
].forEach(relativePath => {
  const file = path.join(root, relativePath);
  assert(fs.existsSync(file) && fs.statSync(file).size > 0, `${relativePath} must be generated locally`);
});

// Phase 2C: centralize only the three existing state-icon update paths and keep Modal lifecycle untouched.
const jsFiles = collectJsFiles(path.join(root, 'assets/js'));
const uiSource = [html, ...jsFiles.map(file => fs.readFileSync(file, 'utf8'))].join('\n');
const faReferences = uiSource.match(/\bfa-(?!solid\b)[a-z0-9-]+\b/g) || [];
const carbonReferences = uiSource.match(/data-carbon-icon=/g) || [];
assert(faReferences.length === 89, `Phase 2C Font Awesome baseline must be 89 references, found ${faReferences.length}`);
assert(carbonReferences.length === 37, `Phase 2C Carbon icon baseline must be 37 references, found ${carbonReferences.length}`);
assert((uiSource.match(/<cds-(?:icon-)?button\b/g) || []).length === 6, 'official Carbon Button total must remain six');

assert(html.indexOf('assets/js/core/icon-adapter.js') < html.indexOf('assets/js/core/theme-controller.js'), 'state icon adapter must load before theme controller');
[
  ["theme", "light: 'moon'", "dark: 'sun'"],
  ["editLock", "unlocked: 'unlocked'", "locked: 'locked'"],
  ["waitingTray", "closed: 'chevron--up'", "open: 'chevron--down'"]
].forEach(([group, first, second]) => {
  assert(adapter.includes(`${group}: Object.freeze({`) && adapter.includes(first) && adapter.includes(second), `${group} mapping must be centralized`);
});
assert(adapter.includes("matches.forEach(node => node.remove())"), 'adapter must remove duplicate state icons');
assert(adapter.includes("placeholder.setAttribute('aria-hidden', 'true')"), 'state icons must remain decorative');
assert(themeController.includes("setStateIcon(button, 'theme'") && !/fa-(?:sun|moon)/.test(themeController), 'theme controller must delegate its icon mapping');
assert(lockProtection.includes("setStateIcon(btn, 'editLock'") && !/fa-(?:lock|unlock)\b/.test(lockProtection), 'edit lock controller must delegate its icon mapping');
assert(waitingTray.includes("setStateIcon(label, 'waitingTray'") && !/fa-chevron-(?:up|down)/.test(waitingTray), 'waiting tray must delegate its icon mapping');

const htmlIconContracts = [
  ['themeToggleBtn', 'data-state-icon="theme"'],
  ['editLockBtn', 'data-state-icon="editLock"'],
  ['tray-toggle-label', 'data-state-icon="waitingTray"'],
  ['userGuideModalTitle', 'data-carbon-icon="help"'],
  ['settlementSettingsModalTitle', 'data-carbon-icon="settings--adjust"'],
  ['settlementCarEditModalTitle', 'data-carbon-icon="car-small"'],
  ['routeDistanceModalTitle', 'data-carbon-icon="roadmap"'],
  ['historyModalTitle', 'data-carbon-icon="recently-viewed"'],
  ['planningCheckModalTitle', 'data-carbon-icon="task"'],
  ['debugModalTitle', 'data-carbon-icon="magic-wand"']
];
htmlIconContracts.forEach(([id, token]) => {
  const start = html.indexOf(`id="${id}"`);
  assert(start >= 0 && html.slice(start, start + 500).includes(token), `${id} must retain its ID and use ${token}`);
});
assert(html.includes('<span data-carbon-icon="table" class="me-2 text-accent" aria-hidden="true"></span>スプレッドシートからまとめて登録'), 'batch import heading must use Carbon table');
assert(html.includes('<span data-carbon-icon="information" aria-hidden="true"></span><span>各項目の見出し行'), 'batch import helper must use Carbon information');
assert(html.includes('<span data-carbon-icon="idea" aria-hidden="true"></span>候補'), 'route helper heading must use Carbon idea');
assert((settlementRender.match(/data-carbon-icon="car-small"/g) || []).length === 2, 'dynamic settlement car title must retain its icon across both updates');

['moon', 'sun', 'locked', 'unlocked', 'chevron--up', 'chevron--down', 'information', 'settings--adjust', 'roadmap', 'idea'].forEach(icon => {
  assert(entry.includes(`@carbon/icons/es/${icon}/20.js`), `Carbon ${icon} definition must be bundled`);
});
assert(entry.includes("['id', 'slot', 'data-state-icon', 'data-icon-state']"), 'Carbon renderer must retain adapter metadata');
assert(html.includes('<i class="fas fa-user-plus" aria-hidden="true"></i>'), 'seat picker custom empty state must remain excluded');
assert(html.includes('<button id="addRouteStopBtn"') && html.includes('<i class="fas fa-plus me-1" aria-hidden="true"></i>場所を追加'), 'route action icon must remain excluded with its sub-48px Button');
assert(html.includes('<button id="openGoogleRouteBtn"') && html.includes('<i class="fab fa-google" aria-hidden="true"></i>Google Mapで距離を確認'), 'external route action icon must remain excluded with its sub-48px Button');
assert(waitingTray.includes('function toggleTray()') && waitingTray.includes('save();'), 'waiting tray lifecycle and persistence call must remain');
assert(html.includes('class="modal fade" id="settlementSettingsModal"'), 'Bootstrap Modal structure must remain');

[
  ['data-bs-toggle', 2],
  ['data-bs-dismiss', 15],
  ['bootstrap.Modal', 12],
  ['hide.bs.modal', 2],
  ['hidden.bs.modal', 8]
].forEach(([token, expected]) => {
  const count = uiSource.split(token).length - 1;
  assert(count === expected, `${token} baseline changed: expected ${expected}, found ${count}`);
});

console.log('Carbon shared static contract check OK through Phase 2C');
