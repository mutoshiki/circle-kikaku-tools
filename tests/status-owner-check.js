const path = require('path');
const fs = require('fs');
const { root, readText, readCssBundle } = require('./helpers/read-project');
const app = fs.readFileSync(path.join(root, 'assets', 'js', 'core', 'app-status.js'), 'utf8');
const featureCss = readCssBundle(root);

const updateMatch = app.match(/function updateStatus\(kind = 'neutral', message = ''\) \{[\s\S]*?\n\}/);
if (!updateMatch) {
  console.error('updateStatus not found');
  process.exit(1);
}
if (updateMatch[0].includes('showMiniToast')) {
  console.error('updateStatus still shows bottom toast');
  process.exit(1);
}
if (!updateMatch[0].includes('setPersistentSaveStatus')) {
  console.error('updateStatus no longer updates persistent badge');
  process.exit(1);
}
if (!featureCss.includes('#syncStatusBadge')) {
  console.error('CSS owner bundle is not owning #syncStatusBadge');
  process.exit(1);
}
if (!featureCss.includes('#bottom-tray')) {
  console.error('CSS owner bundle should own bottom tray styles after consolidation');
  process.exit(1);
}
console.log('Status owner check OK');
