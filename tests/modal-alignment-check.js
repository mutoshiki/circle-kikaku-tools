const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const owner = fs.readFileSync(path.join(root, 'assets', 'css', '103-modal-fixes.css'), 'utf8');

const required = [
  'General modal alignment repair',
  '#batchImportModal .modal-dialog',
  '#routeDistanceModal .modal-dialog',
  '#commonEditModal .modal-dialog',
  'margin-left: auto',
  'margin-right: auto',
  'overflow-x: hidden',
  'width: min(920px, calc(100vw - 32px))'
];

const missing = required.filter(token => !owner.includes(token));
if (missing.length) {
  console.error('Missing modal alignment repair tokens:', missing.join(', '));
  process.exit(1);
}

console.log('Modal alignment check OK');
