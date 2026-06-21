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
const css = readCssBundle();
const cssLinks = [...html.matchAll(/\.\/assets\/css\/([^\"]+\.css)/g)].map(match => match[1]);

const removedAggregators = [
  '01-app-shell.css', '03-guides-modals.css', '04-cars-members-tray.css', '05-settlement.css',
  '00-base-tokens.css', '02-theme-appearance.css', '10-button-system.css',
  'app-shell/01-layout-core.css', 'app-shell/02-edit-controls.css', 'app-shell/03-header-system.css',
  'app-shell/04-header-mobile-layout.css', 'app-shell/05-header-mobile-responsive.css',
  'guides-modals/01-modal-dropdown-base.css', 'guides-modals/02-guide-cards.css', 'guides-modals/03-guide-mockups.css',
  'guides-modals/04-dialog-layout.css', 'guides-modals/05-import-guide.css', 'guides-modals/06-copy-lock-notices.css',
  'guides-modals/07-overview-drawer.css', 'guides-modals/08-modal-z-layer.css'
];
for (const file of removedAggregators) {
  assert(!cssLinks.includes(file), `${file} should not be loaded after the direct leaf-link refactor`);
  assert(!fs.existsSync(path.join(root, 'assets/css', file)), `${file} should be removed after the direct leaf-link refactor`);
}

const requiredLeafOwners = [
  'tokens/01-color-scheme.css',
  'components/00-component-contracts.css',
  'app-shell/layout/01-app-frame.css',
  'app-shell/edit/01-edit-base.css',
  'app-shell/header/01-header-base.css',
  'app-shell/header/02-room-status.css',
  'app-shell/header/03-tabs-actions.css',
  'guides-modals/modal/01-modal-base.css',
  'guides-modals/guide/01-guide-cards.css',
  'guides-modals/dialog/01-dialog-shell.css',
  'guides-modals/import-guide/01-import-shell.css',
  'guides-modals/notices/01-copy-lock.css',
  'guides-modals/overview/01-overview-drawer.css',
  'guides-modals/z-layer/01-z-layer.css'
];
for (const file of requiredLeafOwners) {
  assert(cssLinks.includes(file), `${file} should be linked directly from index.html`);
  assert(fs.existsSync(path.join(root, 'assets/css', file)), `${file} is missing`);
}

assert(!fs.existsSync(path.join(root, 'assets/css/visual')), 'visual override directory must not exist');
assert(!cssLinks.some(file => file.startsWith('visual/')), 'visual override CSS must not be linked');
assert(css.includes('.guide-feature-card'), 'guide feature card styles should live in guides/modals leaf CSS');

console.log('CSS fixed scope owner check OK');
