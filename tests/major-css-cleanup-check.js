const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const cssDir = path.join(root, 'assets', 'css');

const appearance = fs.readFileSync(path.join(cssDir, '102-appearance-modal.css'), 'utf8');
const modal = fs.readFileSync(path.join(cssDir, '103-modal-fixes.css'), 'utf8');

const oldFiles = [
  '03d-legacy-theme-mobile-overrides.css',
  '03d-theme-picker.css',
  '03d-theme-picker-cleanup.css',
  '03e-late-maintenance.css'
];

if (!appearance.includes('Theme picker dropdown consolidated owner')) {
  console.error('Theme picker consolidated owner block missing');
  process.exit(1);
}

if (modal.includes('#appearanceModal')) {
  console.error('103-modal-fixes.css should not own appearanceModal');
  process.exit(1);
}

const forbiddenInOld = [
  'theme-preview-toolbar',
  'theme-preview-content',
  'theme-preview-car',
  'theme-preview-seisan',
  '#appearanceModal .theme-choice-scroller'
];

const offenders = [];
for (const file of oldFiles) {
  const text = fs.readFileSync(path.join(cssDir, file), 'utf8');
  for (const token of forbiddenInOld) {
    if (text.includes(token)) offenders.push(`${file}: ${token}`);
  }
}

if (offenders.length) {
  console.error('Old appearance/theme rules remain:', offenders.join('; '));
  process.exit(1);
}

console.log('Major CSS cleanup check OK');
