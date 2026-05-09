const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'assets', 'js', 'app.js'), 'utf8');
const statusCss = fs.readFileSync(path.join(root, 'assets', 'css', '04-status-badge.css'), 'utf8');
const waitingCss = fs.readFileSync(path.join(root, 'assets', 'css', '04-waiting-tray.css'), 'utf8');

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
if (!statusCss.includes('#syncStatusBadge')) {
  console.error('04-status-badge.css is not owning #syncStatusBadge');
  process.exit(1);
}
if (waitingCss.includes('.sync-status-badge') || waitingCss.includes('.sync-status-dot')) {
  console.error('04-waiting-tray.css still contains sync status badge styles');
  process.exit(1);
}
console.log('Status owner check OK');
