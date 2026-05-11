const { root, readText, readCssBundle } = require('./helpers/read-project');
const owner = readCssBundle(root);

const required = [
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
