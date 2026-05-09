const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const owner = fs.readFileSync(path.join(root, 'assets', 'css', '104-room-input.css'), 'utf8');

const required = [
  'Dark room name input repair',
  '[data-theme="dark"] .app-room-field',
  '[data-theme="dark"] .app-room-input',
  'background: transparent',
  'box-shadow: none',
  'border: 0'
];

const missing = required.filter(token => !owner.includes(token));
if (missing.length) {
  console.error('Missing dark room input repair tokens:', missing.join(', '));
  process.exit(1);
}

console.log('Dark room input check OK');
