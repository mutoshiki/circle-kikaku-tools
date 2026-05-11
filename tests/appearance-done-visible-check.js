const { root, readText, readCssBundle } = require('./helpers/read-project');
const html = readText('index.html');
const repair = readCssBundle(root);

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

const missing = required.filter(token => !repair.includes(token));
if (missing.length) {
  console.error('Missing appearance done visible repair tokens:', missing.join(', '));
  process.exit(1);
}

console.log('Appearance done visible check OK');
