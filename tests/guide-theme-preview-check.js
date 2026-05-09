const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const guide = fs.readFileSync(path.join(root, 'assets', 'css', '101-guide-fixes.css'), 'utf8');
const appearance = fs.readFileSync(path.join(root, 'assets', 'css', '102-appearance-modal.css'), 'utf8');
const owner = `${guide}\n${appearance}`;

if (!html.includes('theme-simple-preview')) {
  console.error('Simplified theme preview markup not found');
  process.exit(1);
}
if (html.includes('theme-preview-content')) {
  console.error('Old complex theme preview content remains');
  process.exit(1);
}
if (!owner.includes('Guide alignment repair')) {
  console.error('Guide alignment repair CSS not found');
  process.exit(1);
}
if (!owner.includes('Simplified theme preview')) {
  console.error('Simplified theme preview CSS not found');
  process.exit(1);
}
console.log('Guide/theme preview check OK');
