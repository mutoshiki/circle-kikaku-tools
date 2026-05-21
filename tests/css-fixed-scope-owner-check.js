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
const cssLinks = [...html.matchAll(/\.\/assets\/css\/([^\"]+\.css)/g)].map(match => match[1]);

const deprecatedAggregators = ['01-app-shell.css', '03-guides-modals.css', '04-cars-members-tray.css', '05-settlement.css'];
for (const file of deprecatedAggregators) {
  assert(!cssLinks.includes(file), `${file} should not be loaded after the direct leaf-link refactor`);
  const content = readText(`assets/css/${file}`);
  assert(!/^\s*@import\b/m.test(content), `${file} must not contain active @import rules`);
}

const requiredLeafOwners = [
  'app-shell/01-layout-core.css',
  'app-shell/02-edit-controls.css',
  'app-shell/03-header-room.css',
  'app-shell/04-mobile-header-layout.css',
  'app-shell/05-mobile-header-responsive.css',
  'app-shell/06-mobile-header-repairs.css',
  'guides-modals/01-modal-dropdown-base.css',
  'guides-modals/02-guide-cards.css',
  'guides-modals/03-guide-mockups.css',
  'guides-modals/04-modal-repairs.css'
];
for (const file of requiredLeafOwners) {
  assert(cssLinks.includes(file), `${file} should be linked directly from index.html`);
  assert(fs.existsSync(path.join(root, 'assets/css', file)), `${file} is missing`);
}

const theme = readText('assets/css/02-theme-appearance.css');
assert(!theme.includes('.guide-feature-card,'), 'guide feature cards must not be styled from theme appearance');

const guideBundle = ['guides-modals/02-guide-cards.css', 'guides-modals/03-guide-mockups.css', 'guides-modals/04-modal-repairs.css']
  .map(file => readText(`assets/css/${file}`))
  .join('\n');
assert(guideBundle.includes('.guide-feature-card'), 'guide feature card styles should live in guides/modals leaf CSS');

console.log('CSS fixed scope owner check OK');
