const { root, readText, readCssBundle } = require('./helpers/read-project');
const html = readText('index.html');
const css = readCssBundle(root);

const required = [
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

if (!html.includes('./assets/css/04-cars-members-tray.css')) {
  console.error('04-cars-members-tray.css is not loaded');
  process.exit(1);
}

console.log('Badge/check light repair check OK');
