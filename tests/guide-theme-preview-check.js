const { root, readText, readCssBundle } = require('./helpers/read-project');
const html = readText('index.html');
const owner = readCssBundle(root);

if (!html.includes('theme-simple-preview')) {
  console.error('Simplified theme preview markup not found');
  process.exit(1);
}
if (html.includes('theme-preview-content')) {
  console.error('Old complex theme preview content remains');
  process.exit(1);
}
if (!owner.includes('#globalGuideModal .modal-dialog')) {
  console.error('Guide modal alignment CSS not found');
  process.exit(1);
}
if (!owner.includes('#appearanceModal .theme-simple-preview')) {
  console.error('Simplified theme preview CSS not found');
  process.exit(1);
}
console.log('Guide/theme preview check OK');
