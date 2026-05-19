const { root, readText, readCssBundle } = require('./helpers/read-project');
const html = readText('index.html');
const css = readCssBundle(root);

const required = [
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

if (!html.includes('./assets/css/04-cars-members-tray.css')) {
  console.error('04-cars-members-tray.css is not loaded');
  process.exit(1);
}

console.log('Dark badge frame check OK');
