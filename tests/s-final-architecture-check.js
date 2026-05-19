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
const namespace = readText('assets/js/core/app-namespace.js');
const dataState = readText('assets/js/core/data-state.js');
const events = readText('assets/js/features/events.js');
const generatedEvents = readText('assets/js/features/events/03-generated-action-events.js');
const share = readText('assets/js/features/share-actions.js');
const settlement = readText('assets/js/features/settlement.js');
const sheet = readText('assets/js/features/sheet-view.js');

assert(html.indexOf('assets/js/core/app-namespace.js') > -1, 'app namespace is not loaded');
assert(html.indexOf('assets/js/core/app-namespace.js') < html.indexOf('assets/js/core/runtime.js'), 'app namespace must load before runtime');
assert(html.indexOf('assets/js/templates/settlement-templates.js') < html.indexOf('assets/js/features/settlement.js'), 'settlement templates must load before settlement feature');
assert(html.indexOf('assets/js/templates/sheet-templates.js') < html.indexOf('assets/js/features/sheet-view.js'), 'sheet templates must load before sheet feature');

assert(namespace.includes('registerActions') && namespace.includes('runAction'), 'SanpoApp action registry is missing');
assert(namespace.includes('registerTemplates') && namespace.includes('exposeCompat'), 'SanpoApp template/compat registries are missing');
assert(dataState.includes('state?.setSnapshot') || dataState.includes('state.setSnapshot'), 'data-state must write snapshots into SanpoApp.state');

assert(generatedEvents.includes('generatedActionHandlers'), 'generated event module should use a generated action map');
assert(generatedEvents.includes('registerActions') && generatedEvents.includes('runAction'), 'generated event module should dispatch through SanpoApp actions');
assert(!generatedEvents.includes("if (action === 'add-settlement-extra')"), 'generated event module still has the old data-action if-chain');
assert(!sheet.includes('window.copyUrl = copyUrl'), 'sheet-view.js must not own copyUrl');
assert(!share.includes('style.cssText'), 'share-actions.js should not keep inline styles');
assert(settlement.includes('window.SanpoApp.templates.settlement'), 'settlement rendering should use settlement templates');
assert(sheet.includes('window.SanpoApp.templates.sheet'), 'sheet rendering should use sheet templates');

const requiredCssImports = [
  'assets/css/01-app-shell.css',
  'assets/css/03-guides-modals.css',
  'assets/css/04-cars-members-tray.css',
  'assets/css/05-settlement.css'
];
for (const file of requiredCssImports) {
  const content = readText(file);
  assert(content.includes('@import url('), `${file} should be an owner import aggregator`);
}

const requiredSubFiles = [
  'assets/css/app-shell/01-app-shell-owner.css',
  'assets/css/guides-modals/01-guides-modals-owner.css',
  'assets/css/cars-members-tray/01-shared-card-primitives.css',
  'assets/css/cars-members-tray/02-tray-shell.css',
  'assets/css/settlement/01-layout-summary.css',
  'assets/css/settlement/02-common-controls.css',
  'assets/js/templates/settlement-templates.js',
  'assets/js/features/settlement/01-state.js',
  'assets/js/features/settlement/03-render.js',
  'assets/js/templates/sheet-templates.js'
];
for (const file of requiredSubFiles) {
  assert(fs.existsSync(path.join(root, file)), `missing split file: ${file}`);
}

console.log('S final architecture check OK');
