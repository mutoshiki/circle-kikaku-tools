const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const owner = fs.readFileSync(path.join(root, 'assets', 'css', '102-appearance-modal.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'assets', 'js', 'app.js'), 'utf8');

const requiredCss = [
  'Appearance modal footer repair - visible absolute footer version',
  '#appearanceModal .modal-content',
  '#appearanceModal .modal-body',
  '#appearanceModal .modal-footer',
  'position: absolute',
  'pointer-events: auto',
  'overflow-y: auto'
];

const missingCss = requiredCss.filter(token => !owner.includes(token));
if (missingCss.length) {
  console.error('Missing appearance footer repair tokens:', missingCss.join(', '));
  process.exit(1);
}

const footerBlock = owner.match(/#appearanceModal \.modal-footer \{[\s\S]*?\}/)?.[0] || '';
if (footerBlock.includes('position: sticky')) {
  console.error('appearance footer still uses sticky');
  process.exit(1);
}

if (!app.includes('function setupAppearanceFooterSafety()') || !app.includes('setupAppearanceFooterSafety();')) {
  console.error('appearance footer safety JS not wired');
  process.exit(1);
}

console.log('Appearance footer check OK');
