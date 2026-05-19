const fs = require('fs');
const path = require('path');
const { root, readText } = require('./helpers/read-project');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const html = readText('index.html');
const app = readText('assets/js/app.js');
const sync = readText('assets/js/core/sync-controller.js');
const render = readText('assets/js/core/render-controller.js');
const guard = readText('assets/js/core/settlement-edit-guard.js');
const settlementFacade = readText('assets/js/features/settlement.js');
const carsOwner = readText('assets/css/04-cars-members-tray.css');
const settlementOwner = readText('assets/css/05-settlement.css');
const baseTokens = readText('assets/css/00-base-tokens.css');
const themeAppearance = readText('assets/css/02-theme-appearance.css');
const uiSpec = readText('tests/basic-ui.spec.js');

[
  'assets/js/core/app-status.js',
  'assets/js/core/render-controller.js',
  'assets/js/core/settlement-edit-guard.js',
  'assets/js/core/sync-controller.js',
  'assets/js/core/history-scheduler.js',
  'assets/js/features/settlement/01-state.js',
  'assets/js/features/settlement/02-calculator.js',
  'assets/js/features/settlement/03-render.js',
  'assets/js/features/settlement/04-route-helper.js',
  'assets/js/features/settlement/05-input-actions.js',
  'assets/js/features/settlement/06-share-text.js',
  'assets/css/cars-members-tray/01-shared-card-primitives.css',
  'assets/css/cars-members-tray/02-tray-shell.css',
  'assets/css/cars-members-tray/03-person-card.css',
  'assets/css/cars-members-tray/04-car-card.css',
  'assets/css/cars-members-tray/05-drag-drop.css',
  'assets/css/settlement/02-common-controls.css',
  'assets/css/settlement/03-car-inputs.css',
  'assets/css/settlement/04-route-helper.css',
  'assets/css/settlement/05-checklists-share.css'
].forEach(file => assert(fs.existsSync(path.join(root, file)), `missing deep refactor file: ${file}`));

assert(!app.includes('function save('), 'app.js should not own save() after S-4');
assert(!app.includes('function load('), 'app.js should not own load() after S-4');
assert(!app.includes('function updateUI('), 'app.js should not own updateUI() after S-4');
assert(sync.includes('function save(') && sync.includes('function load('), 'sync-controller.js must own save/load');
assert(sync.includes('function applyPendingRemoteSettlementData('), 'sync-controller.js must own pending remote settlement application');
assert(render.includes('function updateUI(') && render.includes('function refreshRoomTitle('), 'render-controller.js must own render/update helpers');
assert(guard.includes('function commitSettlementAfterKeyboardSettles('), 'settlement-edit-guard.js must own keyboard-safe settlement commits');

assert(settlementFacade.includes('SanpoApp.features.settlement'), 'settlement facade must register feature API');
assert(html.indexOf('assets/js/features/settlement/01-state.js') < html.indexOf('assets/js/features/settlement.js'), 'settlement split files must load before facade');
assert(html.indexOf('assets/js/core/sync-controller.js') < html.indexOf('assets/js/app.js'), 'sync controller must load before app bootstrap');

assert(carsOwner.includes('01-shared-card-primitives.css') && carsOwner.includes('05-drag-drop.css'), 'cars-members tray owner imports are incomplete');
assert(settlementOwner.includes('02-common-controls.css') && settlementOwner.includes('05-checklists-share.css'), 'settlement owner imports are incomplete');
assert(!carsOwner.includes('01-tray-base.css') && !settlementOwner.includes('02-route-helper.css'), 'owner aggregators still load stale split names');

assert(!baseTokens.includes('@keyframes sheetJiggle {\n {'), 'sheetJiggle still has malformed nested braces');
assert(!baseTokens.includes('@keyframes waitingCardNewPulse {\n {'), 'waitingCardNewPulse still has malformed nested braces');
assert(themeAppearance.includes('.theme-system-note {'), 'theme-system note selector should remain standalone');
assert(!themeAppearance.includes('.guide-feature-card,\n.theme-system-note'), 'guide feature card should not be owned by theme appearance');

assert(uiSpec.includes('critical modals stay clickable') && uiSpec.includes('settlement typing keeps focus'), 'Playwright spec must cover modal clickability and settlement typing protection');

console.log('S deep refactor check OK');
