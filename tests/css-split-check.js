const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const expected = [
  '00-base-tokens.css',
  '01-app-shell.css',
  '02-theme-appearance.css',
  '03-guides-modals.css',
  '04-cars-members-tray.css',
  '05-settlement.css',
  '06-sheet-view.css',
  '07-drag-interactions.css'
];

const missing = expected.filter(file => !html.includes(`./assets/css/${file}`));
if (missing.length) {
  console.error('Missing consolidated CSS links:', missing.join(', '));
  process.exit(1);
}

const legacyLoaded = ['04-theme-mobile-compat.css', '05-feature-components.css', '06-structure.css', '99-final-overrides.css', '100-owner-safety.css', '102-appearance-modal.css', '111-input-radius-and-header-fixes.css', '07-repair-safety.css', '08-final-polish.css']
  .filter(file => html.includes(`./assets/css/${file}`));
if (legacyLoaded.length) {
  console.error('Legacy CSS files are still loaded:', legacyLoaded.join(', '));
  process.exit(1);
}

let lastIndex = -1;
for (const file of expected) {
  const index = html.indexOf(`./assets/css/${file}`);
  if (index <= lastIndex) {
    console.error('Consolidated CSS order is wrong near:', file);
    process.exit(1);
  }
  lastIndex = index;
}

for (const file of expected) {
  const cssPath = path.join(root, 'assets', 'css', file);
  if (!fs.existsSync(cssPath)) {
    console.error('Consolidated CSS file does not exist:', file);
    process.exit(1);
  }
}

console.log('CSS selector-owner split check OK');
