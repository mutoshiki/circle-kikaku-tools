const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const cssLinks = [...html.matchAll(/\.\/assets\/css\/([^\"]+\.css)/g)].map(match => match[1]);

if (cssLinks.length < 80) {
  console.error('Direct CSS leaf links look incomplete:', cssLinks.length);
  process.exit(1);
}

for (const file of cssLinks) {
  if (!fs.existsSync(path.join(root, 'assets', 'css', file))) {
    console.error('Linked CSS file does not exist:', file);
    process.exit(1);
  }
}

const requiredOrder = [
  'tokens/01-color-scheme.css',
  'components/00-component-contracts.css',
  'components/surfaces/01-surface-tokens.css',
  'components/buttons/01-button-base.css',
  'app-shell/00-base-extracted.css',
  'app-shell/header/01-header-base.css',
  'app-shell/header/02-room-status.css',
  'app-shell/header/03-tabs-actions.css',
  'guides-modals/00-base-extracted.css',
  'cars-members-tray/00-base-extracted.css',
  'settlement/00-base-extracted.css',
  'sheet-view/layout/01-sheet-frame.css',
  '07-drag-interactions.css',
  '08-utilities.css',
  '09-font-weight-tuning.css'
];
let last = -1;
for (const file of requiredOrder) {
  const idx = cssLinks.indexOf(file);
  if (idx === -1) {
    console.error('Missing direct CSS link:', file);
    process.exit(1);
  }
  if (idx <= last) {
    console.error('CSS direct link order is wrong near:', file);
    process.exit(1);
  }
  last = idx;
}

if (cssLinks.some(file => file.startsWith('visual/'))) {
  console.error('Late visual override layer must not be linked');
  process.exit(1);
}
if (fs.existsSync(path.join(root, 'assets', 'css', 'visual'))) {
  console.error('Late visual override directory must not exist');
  process.exit(1);
}

const removed = [
  '00-base-tokens.css', '02-theme-appearance.css', '10-button-system.css',
  '01-app-shell.css', '03-guides-modals.css', '04-cars-members-tray.css', '05-settlement.css',
  'app-shell/01-layout-core.css', 'app-shell/02-edit-controls.css', 'app-shell/03-header-system.css',
  'app-shell/04-header-mobile-layout.css', 'app-shell/05-header-mobile-responsive.css',
  'settlement/01-page-shell.css', 'settlement/02-summary-cards.css', 'settlement/03-car-inputs.css',
  'settlement/04-route-helper.css', 'sheet-view/01-sheet-layout.css'
];
for (const file of removed) {
  if (html.includes(`./assets/css/${file}`) || fs.existsSync(path.join(root, 'assets', 'css', file))) {
    console.error('Deprecated CSS owner should be removed:', file);
    process.exit(1);
  }
}

console.log('CSS direct leaf split check OK');
