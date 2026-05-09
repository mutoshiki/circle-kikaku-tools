const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets', 'css', '107-badge-check-gender-fixes.css'), 'utf8');

const required = [
  'Badge / check visual fixes for both light and dark modes',
  '.capacity-badge.capacity-edit-btn',
  '.capacity-badge.capacity-edit-btn .capacity-count',
  '.fa-check',
  '.seisan-mock-box-check',
  'background: transparent',
  'border: 0',
  'box-shadow: none'
];

const missing = required.filter(token => !css.includes(token));
if (missing.length) {
  console.error('Missing badge/check light repair tokens:', missing.join(', '));
  process.exit(1);
}

if (!html.includes('./assets/css/107-badge-check-gender-fixes.css')) {
  console.error('107-badge-check-gender-fixes.css is not loaded');
  process.exit(1);
}

if (html.indexOf('106-mobile-ui-polish.css') > html.indexOf('107-badge-check-gender-fixes.css')) {
  console.error('107-badge-check-gender-fixes.css should load after 106-mobile-ui-polish.css');
  process.exit(1);
}

console.log('Badge/check light repair check OK');
