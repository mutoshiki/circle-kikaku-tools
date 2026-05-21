
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const expectedInOrder = [
  '00-base-tokens.css',
  'app-shell/00-base-extracted.css',
  'app-shell/01-layout-core.css',
  'app-shell/02-edit-controls.css',
  'app-shell/03-header-room.css',
  'app-shell/04-mobile-header-layout.css',
  'app-shell/05-mobile-header-responsive.css',
  'app-shell/06-mobile-header-repairs.css',
  '02-theme-appearance.css',
  'guides-modals/00-base-extracted.css',
  'guides-modals/01-modal-dropdown-base.css',
  'guides-modals/02-guide-cards.css',
  'guides-modals/03-guide-mockups.css',
  'guides-modals/04-modal-repairs.css',
  'cars-members-tray/00-base-extracted.css',
  'cars-members-tray/01-shared-card-primitives.css',
  'cars-members-tray/02-tray-shell.css',
  'cars-members-tray/03-person-card.css',
  'cars-members-tray/04-car-card.css',
  'cars-members-tray/05-drag-drop.css',
  'settlement/00-base-extracted.css',
  'settlement/01-page-shell.css',
  'settlement/02-summary-cards.css',
  'settlement/03-guide-mockups.css',
  'settlement/02-common-controls.css',
  'settlement/03-car-inputs.css',
  'settlement/04-route-helper.css',
  'settlement/05-checklists-share.css',
  '06-sheet-view.css',
  '07-drag-interactions.css',
  '08-utilities.css'
];

let lastIndex = -1;
for (const file of expectedInOrder) {
  const href = `./assets/css/${file}`;
  const index = html.indexOf(href);
  if (index === -1) {
    console.error('Missing direct CSS link:', file);
    process.exit(1);
  }
  if (index <= lastIndex) {
    console.error('CSS direct link order is wrong near:', file);
    process.exit(1);
  }
  lastIndex = index;
  if (!fs.existsSync(path.join(root, 'assets', 'css', file))) {
    console.error('Linked CSS file does not exist:', file);
    process.exit(1);
  }
}

const deprecatedAggregators = ['01-app-shell.css', '03-guides-modals.css', '04-cars-members-tray.css', '05-settlement.css'];
for (const file of deprecatedAggregators) {
  if (html.includes(`./assets/css/${file}`)) {
    console.error('Deprecated CSS aggregator is still loaded:', file);
    process.exit(1);
  }
}

console.log('CSS direct leaf split check OK');
