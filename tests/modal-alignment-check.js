const { root, readText, readCssBundle } = require('./helpers/read-project');
const owner = readCssBundle(root);

const required = [
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
