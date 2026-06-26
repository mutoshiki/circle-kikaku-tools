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
const cssDir = path.join(root, 'assets', 'css');
const oldFiles = [
  '04-theme-mobile-compat.css', '05-feature-components.css', '06-structure.css',
  '04-mobile-polish.css', '05-theme-system.css', '06-mobile-v40-layout.css',
  '07-mobile-v41-tuning.css', '08-theme-palette-extensions.css', '09-theme-picker-cleanup.css',
  '10-touch-maintenance.css', '11-feature-components.css', '12-structure-utilities.css',
  '13-drag-interactions.css', '14-core-owner-safety.css', '15-guide-repairs.css',
  '16-appearance-modal.css', '17-modal-alignment.css', '18-room-input.css',
  '19-dark-badge-fixes.css', '20-mobile-ui-polish.css', '21-badge-visuals.css',
  '22-density-responsive.css', '23-header-polish.css', '24-settlement-polish.css',
  '25-input-radius-header.css', '03d-legacy-theme-mobile-overrides.css',
  '03d-theme-picker.css', '03d-theme-picker-cleanup.css', '03e-late-maintenance.css',
  '99-final-overrides.css', '102-appearance-modal.css', '111-input-radius-and-header-fixes.css'
];

assert(!html.includes('appearanceSettingsBtn') && !html.includes('appearanceModal'), 'removed visual-mode controls remain in HTML');
assert(!html.includes('/assets/css/visual/'), 'late visual override CSS remains linked');
assert(!fs.existsSync(path.join(root, 'assets/css/visual')), 'late visual override directory remains');
assert(!fs.existsSync(path.join(root, 'assets/css/theme')), 'removed visual-mode CSS directory remains');
assert(!fs.existsSync(path.join(root, 'assets/css/settlement/dark')), 'removed dark settlement CSS remains');

const loadedOldFiles = oldFiles.filter(file => html.includes(`./assets/css/${file}`));
assert(!loadedOldFiles.length, `old CSS files are still loaded: ${loadedOldFiles.join(', ')}`);
const topLevelOldFiles = oldFiles.filter(file => fs.existsSync(path.join(cssDir, file)));
assert(!topLevelOldFiles.length, `old CSS files remain at assets/css root: ${topLevelOldFiles.join(', ')}`);

console.log('Major CSS cleanup check OK');
