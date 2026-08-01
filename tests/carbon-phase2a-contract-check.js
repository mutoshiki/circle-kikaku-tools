const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const entry = fs.readFileSync(path.join(root, 'assets/js/carbon-entry.js'), 'utf8');
const bundle = fs.readFileSync(path.join(root, 'assets/vendor/carbon/carbon-entry.min.js'), 'utf8');
const adapter = fs.readFileSync(path.join(root, 'assets/js/core/icon-adapter.js'), 'utf8');
const tagTypes = fs.readFileSync(path.join(root, 'assets/js/core/tag-types.js'), 'utf8');
const themeController = fs.readFileSync(path.join(root, 'assets/js/core/theme-controller.js'), 'utf8');
const lockProtection = fs.readFileSync(path.join(root, 'assets/js/features/lock-protection.js'), 'utf8');
const waitingTray = fs.readFileSync(path.join(root, 'assets/js/features/waiting-tray.js'), 'utf8');
const personCards = fs.readFileSync(path.join(root, 'assets/js/features/person-cards.js'), 'utf8');
const personMenu = fs.readFileSync(path.join(root, 'assets/js/features/person-menu.js'), 'utf8');
const autoAssign = fs.readFileSync(path.join(root, 'assets/js/features/auto-assign.js'), 'utf8');
const batchImport = fs.readFileSync(path.join(root, 'assets/js/features/batch-import.js'), 'utf8');
const renderController = fs.readFileSync(path.join(root, 'assets/js/core/render-controller.js'), 'utf8');
const sheetTemplates = fs.readFileSync(path.join(root, 'assets/js/templates/sheet-templates.js'), 'utf8');
const settlementCostParts = fs.readFileSync(path.join(root, 'assets/js/templates/settlement/01-cost-parts.js'), 'utf8');
const settlementSummaryTemplates = fs.readFileSync(path.join(root, 'assets/js/templates/settlement/02-summary-templates.js'), 'utf8');
const settlementRender = fs.readFileSync(path.join(root, 'assets/js/features/settlement/03-render.js'), 'utf8');
const sharedUi = fs.readFileSync(path.join(root, 'assets/js/modules/ui.js'), 'utf8');
const notificationCss = fs.readFileSync(path.join(root, 'assets/css/guides-modals/notices/01-copy-lock.css'), 'utf8');
const lightThemeCss = fs.readFileSync(path.join(root, 'assets/css/tokens/01-color-scheme.css'), 'utf8');
const darkThemeCss = fs.readFileSync(path.join(root, 'assets/css/tokens/01-theme-modes.css'), 'utf8');

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
assert(entry.includes("@carbon/web-components/es/components/content-switcher/index.js"), 'official cds-content-switcher module must be imported');
assert(entry.includes("@carbon/web-components/es/components/notification/toast-notification.js"), 'official cds-toast-notification module must be imported');
assert(entry.includes("@carbon/web-components/es/components/tag/index.js"), 'official cds-tag module must be imported');
assert(entry.includes("@carbon/icons/es/"), 'official Carbon icon definitions must be imported');
assert(/<script type="module" src="\.\/assets\/vendor\/carbon\/carbon-entry\.min\.js\?v=2\.60\.0-phase3c"><\/script>/.test(html), 'local Carbon module bundle must be loaded');
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

// Phase 3B: AppUI.showStatus remains the sole public entry while the display host becomes Carbon Toast Notification.
assert(sharedUi.includes("window.AppUI = { confirm, alert, showStatus, setSyncStatus, showUndoBar, hideUndoBar }"), 'AppUI.showStatus public API must remain unchanged');
assert(sharedUi.includes("window.showAppNotice = (message, isError = false) => showStatus(message, { tone: isError ? 'error' : 'neutral' })"), 'showAppNotice compatibility caller must remain unchanged');
assert(sharedUi.includes("window.showMiniToast = (message, tone = 'neutral') => showStatus(message, { tone, duration: 1800 })"), 'showMiniToast compatibility caller must remain unchanged');
[
  ["success", "kind: 'success'"],
  ["error", "kind: 'error'"],
  ["warning", "kind: 'warning'"],
  ["info", "kind: 'info'"],
  ["neutral", "kind: 'info'"]
].forEach(([tone, mapping]) => {
  assert(sharedUi.includes(`${tone}: Object.freeze({ ${mapping}`), `${tone} notification kind must be centralized`);
});
assert(sharedUi.includes("document.createElement('cds-toast-notification')"), 'showStatus must render an official Carbon Toast Notification');
assert(sharedUi.includes("toast.addEventListener('cds-notification-closed'"), 'manual Carbon dismiss must clean up through the official close event');
assert(sharedUi.includes("state.statusTimer = setTimeout(() => removeStatusToast(toast), duration)"), 'existing single auto-dismiss timer contract must remain');
assert(sharedUi.includes("Math.max(800, options.duration) : 2200"), 'existing 800ms minimum and 2200ms default duration must remain');
assert(!sharedUi.includes("document.createElement('div');\n    toast.id = 'appStatusToast'"), 'legacy generic toast display node must be removed');
assert(notificationCss.includes('.app-status-toast') && notificationCss.includes('bottom: max(20px, env(safe-area-inset-bottom))'), 'Carbon Toast host must retain the existing bottom-center position');
assert(notificationCss.includes('--app-toast-scale: 1.1429') && notificationCss.includes('--app-toast-scale: 1.0667'), 'Carbon Toast host must restore the official 48px rem geometry at desktop and mobile type scales');
assert(notificationCss.includes('width: calc((100vw - 24px) * 0.9375)'), 'Carbon Toast host must remain responsive for long Japanese messages');
assert(!/shadowRoot|::part|cds--toast-notification__/.test(notificationCss), 'application CSS must not depend on Carbon Toast Shadow DOM internals');
assert(lightThemeCss.includes('--cds-icon-inverse: #ffffff') && lightThemeCss.includes('--cds-focus-inverse: #ffffff'), 'light theme must expose inverse Toast icon and focus tokens');
assert(darkThemeCss.includes('--cds-icon-inverse: #161616') && darkThemeCss.includes('--cds-focus-inverse: #0f62fe'), 'dark theme must expose inverse Toast icon and focus tokens');

// Phase 3C: migrate only passive, self-describing labels and keep all business decisions in existing renderers.
assert(html.indexOf('assets/js/core/tag-types.js') < html.indexOf('assets/js/features/person-cards.js'), 'Tag type adapter must load before display renderers');
[
  ["grade", "male: 'blue'", "female: 'magenta'", "unknown: 'gray'"],
  ["cost", "split: 'blue'", "club: 'warm-gray'", "pay: 'magenta'"],
  ["sheetPlan", "car: 'blue'", "team: 'purple'"],
  ["capacity", "normal: 'gray'", "over: 'red'"],
  ["importSource", "studentId: 'cyan'", "grade: 'blue'", "none: 'gray'"]
].forEach(([group, ...mappings]) => {
  assert(tagTypes.includes(`${group}: Object.freeze({`) && mappings.every(mapping => tagTypes.includes(mapping)), `${group} Tag type mapping must be centralized`);
});
assert(tagTypes.includes("function resolve(group, value, fallback = 'gray')"), 'Tag type adapter must remain a minimal presentation mapping');
assert(tagTypes.includes('window.SanpoTagTypes = Object.freeze({ mappings, resolve, attributes })'), 'Tag type adapter must expose only presentation helpers');
assert(!/localStorage|Firebase|save\(|calculate|addEventListener/.test(tagTypes), 'Tag type adapter must not own state, persistence, calculation, or events');

assert(personCards.includes('<cds-tag class="grade-badge carbon-display-tag') && personCards.includes('data-grade="${n}"'), 'grade labels must use Carbon Tag while preserving grade-badge and data-grade');
assert(personMenu.includes("ce('cds-tag', `grade-badge carbon-display-tag") && personMenu.includes("badge.dataset.grade = String(grade)"), 'dynamic grade updates must preserve the existing grade contract');
assert(autoAssign.includes("oldBadge.className = `grade-badge carbon-display-tag") && autoAssign.includes("oldBadge.dataset.tagValue = gender"), 'automatic assignment must only refresh grade Tag presentation metadata');
assert(settlementCostParts.includes('<cds-tag class="seisan-cost-policy-tag seisan-cost-type-badge') && settlementCostParts.includes('data-cost-type="${config.type}"'), 'settlement classifications must use Carbon Tag while preserving data-cost-type');
assert(batchImport.includes('<cds-tag class="form-import-source-chip carbon-display-tag"') && batchImport.includes("attributes('importSource', gradeSourceKey"), 'import-source labels must use the centralized Carbon Tag mapping');
assert(renderController.includes("document.createElement('cds-tag')") && renderController.includes("planLabel.className = 'sheet-summary-plan-label carbon-display-tag'"), 'shared sheet plan labels must use Carbon Tag and preserve their class');
assert(sheetTemplates.includes('<cds-tag class="sheet-capacity-badge carbon-display-tag') && sheetTemplates.includes("attributes('capacity', capacityState, 'md')"), 'shared sheet capacity labels must use Carbon Tag without moving the capacity decision');

const migratedTagSources = [html, personCards, personMenu, autoAssign, settlementCostParts, batchImport, renderController, sheetTemplates].join('\n');
assert(!/<cds-tag\b[^>]*\b(?:role|tabindex|aria-label)=/i.test(migratedTagSources), 'passive Carbon Tags must not gain interactive or redundant accessibility attributes');
assert(!/<cds-tag\b[^>]*\b(?:filter|disabled|href)=/i.test(migratedTagSources), 'Phase 3C must not introduce closable, selectable, or otherwise interactive Tags');
assert(html.includes('id="syncStatusBadge" class="sync-status-badge"'), 'local save status must remain excluded');
assert(html.includes('id="planningCheckCount" class="planning-check-count"'), 'Button count label must remain excluded');
assert(html.includes('id="waiting-count" class="waiting-inline-count"'), 'unassigned tray count must remain excluded');
assert([html, personCards, renderController].some(source => source.includes('capacity-edit-btn')), 'interactive capacity editor must remain excluded');
assert(settlementCostParts.includes('seisan-cost-type-badge--spacer'), 'structural settlement spacer must remain excluded');
assert(settlementSummaryTemplates.includes('seisan-summary-pills'), 'settlement summary mini-cards must remain excluded');

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

console.log('Carbon shared static contract check OK through Phase 3C');
