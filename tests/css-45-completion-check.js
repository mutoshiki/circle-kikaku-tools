const fs = require('fs');
const path = require('path');
const { root, readText, readCssBundle, readSettlementTemplateBundle, listCssFiles } = require('./helpers/read-project');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const html = readText('index.html');
const css = readCssBundle();
const templates = readSettlementTemplateBundle();
const packageJson = JSON.parse(readText('package.json'));
const cssFiles = listCssFiles().map(file => path.relative(path.join(root, 'assets/css'), file).replace(/\\/g, '/'));

const requiredDirs = [
  'tokens/', 'components/buttons/', 'components/surfaces/', 'theme/',
  'app-shell/layout/', 'app-shell/edit/', 'app-shell/header/',
  'guides-modals/modal/', 'guides-modals/dialog/', 'guides-modals/import-guide/', 'guides-modals/z-layer/',
  'cars-members-tray/waiting-tray/', 'cars-members-tray/person-card/', 'cars-members-tray/car-card/', 'cars-members-tray/drag-drop/',
  'settlement/page-shell/', 'settlement/summary/', 'settlement/controls/', 'settlement/car-inputs/', 'settlement/route-helper/',
  'settlement/checklists/', 'settlement/share/', 'settlement/cost-tags/', 'settlement/payment-chip/', 'settlement/car-cost-summary/',
  'sheet-view/layout/', 'sheet-view/waiting/', 'sheet-view/timetable/', 'sheet-view/edit/', 'sheet-view/print/'
];
for (const dir of requiredDirs) {
  assert(cssFiles.some(file => file.startsWith(dir)), `missing CSS owner directory: ${dir}`);
}

for (const file of cssFiles) {
  const text = fs.readFileSync(path.join(root, 'assets/css', file), 'utf8');
  const lines = text.split(/\r?\n/).length;
  assert(lines <= 320, `CSS leaf is too large: ${file} has ${lines} lines`);
  assert(!/(repair|fix|guard|continued|final|adjustments?|follow-?up)/i.test(path.basename(file)), `CSS filename should be responsibility-based: ${file}`);
  assert(!text.includes('!important'), `!important should not be used: ${file}`);
}

const removedFiles = [
  '00-base-tokens.css', '02-theme-appearance.css', '10-button-system.css', '09-surface-hierarchy.css', '08-control-consistency.css',
  'app-shell/01-layout-core.css', 'app-shell/02-edit-controls.css', 'app-shell/03-header-system.css',
  'app-shell/04-header-mobile-layout.css', 'app-shell/05-header-mobile-responsive.css',
  'cars-members-tray/02-tray-shell.css', 'cars-members-tray/03-person-card.css', 'cars-members-tray/04-car-card.css',
  'settlement/01-page-shell.css', 'settlement/02-summary-cards.css', 'settlement/03-car-inputs.css', 'settlement/04-route-helper.css',
  'sheet-view/01-sheet-layout.css', 'sheet-view/03-timetable.css'
];
for (const file of removedFiles) {
  assert(!fs.existsSync(path.join(root, 'assets/css', file)), `old CSS file should be deleted: ${file}`);
  assert(!html.includes(`./assets/css/${file}`), `old CSS file should not be linked: ${file}`);
}

assert(css.includes('--z-modal') && css.includes('--z-toast'), 'z-index tokens are missing');
assert(css.includes('--radius-card') && css.includes('--space-6') && css.includes('--font-size-amount'), 'radius/space/type tokens are missing');
assert(css.includes('.ui-amount') && css.includes('.ui-chip') && css.includes('.ui-input') && css.includes('.ui-tab'), 'shared UI contract classes are missing');
assert(templates.includes('const UI_CLASS = Object.freeze'), 'settlement template class contract is missing');
assert(templates.includes('UI_CLASS.amount') && templates.includes('UI_CLASS.chip') && templates.includes('UI_CLASS.surfaceCard'), 'settlement templates should use shared CSS classes');
assert(packageJson.scripts['test:visual'], 'visual test script is missing');
['CSS_ARCHITECTURE.md', 'DESIGN_TOKENS.md', 'UI_COMPONENTS.md', 'CSS_CHANGE_CHECKLIST.md'].forEach(file => {
  assert(fs.existsSync(path.join(root, file)), `${file} should exist`);
});

console.log('CSS 45-point completion check OK');
