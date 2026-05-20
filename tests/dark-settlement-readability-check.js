const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', 'assets', 'css', '08-control-consistency.css');
const css = fs.readFileSync(cssPath, 'utf8');

const oldMarker = 'dark mode readability fix: header share icon + settlement tab';
if (!css.includes(oldMarker)) {
  throw new Error('Dark settlement readability patch is missing.');
}

const marker = '2026-05 theme integrity repair';
const markerIndex = css.lastIndexOf(marker);
if (markerIndex === -1) {
  throw new Error('Theme integrity repair patch is missing.');
}

const block = css.slice(markerIndex);
const required = [
  '--theme-filled-control-text',
  '--header-icon-text',
  '#shareLinkBtn.header-action',
  '#routeHelperBtn.seisan-btn',
  '.seisan-btn.primary',
  '#shuffleAssignBtn.tray-action-btn',
  '#settlementCarEditModal .seisan-distance-shortcut',
  '-webkit-text-fill-color: var(--theme-filled-control-text)'
];

for (const token of required) {
  if (!block.includes(token)) {
    throw new Error(`Theme integrity patch is incomplete: missing ${token}`);
  }
}

console.log('Dark settlement readability check OK');
