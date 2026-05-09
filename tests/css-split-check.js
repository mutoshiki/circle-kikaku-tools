const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const expected = [
  '100-owner-safety.css',
  '101-guide-fixes.css',
  '102-appearance-modal.css',
  '103-modal-fixes.css',
  '104-room-input.css'
];

const missing = expected.filter(file => !html.includes(`./assets/css/${file}`));
if (missing.length) {
  console.error('Missing split CSS links:', missing.join(', '));
  process.exit(1);
}

if (html.includes('./assets/css/100-owner-overrides.css')) {
  console.error('Old 100-owner-overrides.css is still loaded');
  process.exit(1);
}

let lastIndex = -1;
for (const file of expected) {
  const index = html.indexOf(`./assets/css/${file}`);
  if (index <= lastIndex) {
    console.error('Split CSS order is wrong near:', file);
    process.exit(1);
  }
  lastIndex = index;
}

for (const file of expected) {
  const cssPath = path.join(root, 'assets', 'css', file);
  if (!fs.existsSync(cssPath)) {
    console.error('Split CSS file does not exist:', file);
    process.exit(1);
  }
}

console.log('CSS split check OK');
