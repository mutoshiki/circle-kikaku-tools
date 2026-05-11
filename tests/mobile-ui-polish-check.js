const { root, readText, readCssBundle } = require('./helpers/read-project');
const html = readText('index.html');
const css = readCssBundle(root);

const required = [
  '@media (max-width: 640px)',
  '[data-theme="dark"] .app-header-main',
  '[data-theme="dark"] .member-card',
  '[data-theme="dark"] #bottom-tray',
  '#appearanceModal .modal-footer',
];

const haystack = `${html}
${css}`;
const missing = required.filter(token => !haystack.includes(token));
if (missing.length) {
  console.error('Missing mobile UI polish tokens:', missing.join(', '));
  process.exit(1);
}

console.log('Mobile UI polish check OK');
