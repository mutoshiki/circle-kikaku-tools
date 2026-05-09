const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appearance = fs.readFileSync(path.join(root, 'assets', 'css', '102-appearance-modal.css'), 'utf8');
const modal = fs.readFileSync(path.join(root, 'assets', 'css', '103-modal-fixes.css'), 'utf8');

if (!html.includes('data-bs-dismiss="modal">完了</button>')) {
  console.error('Appearance Done button markup is missing');
  process.exit(1);
}

const required = [
  '#appearanceModal .modal-content',
  'position: relative',
  '#appearanceModal .modal-body',
  'padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 74px)',
  '#appearanceModal .modal-footer',
  'position: absolute',
  'bottom: 0',
  'z-index: 320',
  'pointer-events: auto'
];

const missing = required.filter(token => !appearance.includes(token));
if (missing.length) {
  console.error('Missing appearance done visible repair tokens:', missing.join(', '));
  process.exit(1);
}

if (modal.includes('#appearanceModal')) {
  console.error('103-modal-fixes.css should not own appearanceModal');
  process.exit(1);
}

console.log('Appearance done visible check OK');
