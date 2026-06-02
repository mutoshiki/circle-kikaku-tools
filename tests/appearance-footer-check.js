const { root, readText, readCssBundle } = require('./helpers/read-project');
const owner = readCssBundle(root);
const js = [
  'assets/js/features/appearance.js',
  'assets/js/features/events.js',
  'assets/js/app.js'
].map(readText).join('\n');

const requiredCss = [
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

if (!js.includes('function setupAppearanceFooterSafety()') || !(js.includes('setupAppearanceFooterSafety();') || js.includes('setupAppearanceFooterSafety?.();'))) {
  console.error('appearance footer safety JS not wired');
  process.exit(1);
}

console.log('Appearance footer check OK');
