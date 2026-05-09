const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets', 'css', '105-dark-badge-fixes.css'), 'utf8');

const required = [
  'Dark badge/check frame fixes',
  '[data-theme="dark"] .capacity-badge.capacity-edit-btn',
  '[data-theme="dark"] .capacity-badge.capacity-edit-btn .capacity-count',
  '[data-theme="dark"] .fa-check',
  '[data-theme="dark"] .seisan-mock-box-check',
  'background: transparent',
  'border: 0',
  'box-shadow: none'
];

const missing = required.filter(token => !css.includes(token));
if (missing.length) {
  console.error('Missing dark badge frame repair tokens:', missing.join(', '));
  process.exit(1);
}

if (!html.includes('./assets/css/105-dark-badge-fixes.css')) {
  console.error('105-dark-badge-fixes.css is not loaded');
  process.exit(1);
}

if (html.indexOf('104-room-input.css') > html.indexOf('105-dark-badge-fixes.css')) {
  console.error('105-dark-badge-fixes.css should load after 104-room-input.css');
  process.exit(1);
}

console.log('Dark badge frame check OK');
