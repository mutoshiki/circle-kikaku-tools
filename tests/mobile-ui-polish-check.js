const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets', 'css', '106-mobile-ui-polish.css'), 'utf8');

const required = [
  'Mobile UI polish',
  '@media (max-width: 640px)',
  '[data-theme="dark"] .app-header-main',
  '[data-theme="dark"] .member-card',
  '[data-theme="dark"] #bottom-tray',
  '#appearanceModal .modal-footer',
  '106-mobile-ui-polish.css'
];

const haystack = `${html}\n${css}`;
const missing = required.filter(token => !haystack.includes(token));
if (missing.length) {
  console.error('Missing mobile UI polish tokens:', missing.join(', '));
  process.exit(1);
}

if (html.indexOf('105-dark-badge-fixes.css') > html.indexOf('106-mobile-ui-polish.css')) {
  console.error('106-mobile-ui-polish.css should load after 105-dark-badge-fixes.css');
  process.exit(1);
}

console.log('Mobile UI polish check OK');
