const { root, readText, readCssBundle } = require('./helpers/read-project');
const html = readText('index.html');
const css = readCssBundle(root);

const required = [
  '@media (max-width: 640px)',
  '.app-header-main',
  '.member-card',
  '#bottom-tray',
  '--mobile-touch: 44px'
];
const haystack = `${html}\n${css}`;
const missing = required.filter(token => !haystack.includes(token));
if (missing.length) {
  console.error('Missing mobile UI polish tokens:', missing.join(', '));
  process.exit(1);
}
console.log('Mobile UI polish check OK');
