const fs = require('fs');
const path = require('path');
const { root, readText, readCssBundle } = require('./helpers/read-project');

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
const carsOwner = readCssBundle();
const settlementOwner = readCssBundle();
const baseTokens = readCssBundle();
const visualSystem = readCssBundle();
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
  'assets/css/cars-members-tray/waiting-tray/01-tray-shell.css',
  'assets/css/cars-members-tray/person-card/01-person-card-shell.css',
  'assets/css/cars-members-tray/car-card/01-card-shell.css',
  'assets/css/cars-members-tray/drag-drop/01-card-drag.css',
  'assets/css/settlement/controls/01-control-shell.css',
  'assets/css/settlement/car-inputs/01-car-form.css',
  'assets/css/settlement/route-helper/01-route-shell.css',
  'assets/css/settlement/checklists/01-collection-list.css',
  'assets/css/settlement/checklists/03-driver-payment-list.css',
  'assets/css/settlement/share/01-share-output.css'
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

assert(html.includes('assets/css/cars-members-tray/01-shared-card-primitives.css') && html.includes('assets/css/cars-members-tray/drag-drop/01-card-drag.css'), 'cars-members tray leaf CSS links are incomplete');
assert(html.includes('assets/css/settlement/controls/01-control-shell.css') && html.includes('assets/css/settlement/checklists/01-collection-list.css') && html.includes('assets/css/settlement/checklists/03-driver-payment-list.css'), 'settlement leaf CSS links are incomplete');
assert(!html.includes('01-tray-base.css') && !html.includes('02-route-helper.css'), 'stale split CSS names are still linked');

assert(!baseTokens.includes('@keyframes sheetJiggle {\n {'), 'sheetJiggle still has malformed nested braces');
assert(!baseTokens.includes('@keyframes waitingCardNewPulse {\n {'), 'waitingCardNewPulse still has malformed nested braces');
assert(!html.includes('assets/css/visual/'), 'late visual override layer must not be linked');
assert(!fs.existsSync(path.join(root, 'assets/css/visual')), 'late visual override directory must not exist');
assert(visualSystem.includes('--surface-soft') && visualSystem.includes('--shadow-modal'), 'single visual system tokens are missing');

assert(uiSpec.includes('critical modals stay clickable') && uiSpec.includes('settlement typing keeps focus'), 'Playwright spec must cover modal clickability and settlement typing protection');

console.log('S deep refactor check OK');
