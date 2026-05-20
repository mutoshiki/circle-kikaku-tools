const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', 'assets', 'css', '08-control-consistency.css');
const css = fs.readFileSync(cssPath, 'utf8');

const marker = '2026-05 theme integrity repair';
const markerIndex = css.lastIndexOf(marker);
if (markerIndex === -1) {
  throw new Error('Theme integrity repair rule is missing.');
}

const fixBlock = css.slice(markerIndex);
if (!fixBlock.includes('#shareLinkBtn.header-action') ||
    !fixBlock.includes('--header-icon-text') ||
    !fixBlock.includes('color: var(--header-icon-text)') ||
    !fixBlock.includes('-webkit-text-fill-color: var(--header-icon-text)')) {
  throw new Error('Dark mode share link icon is not normalized with the other header icons.');
}

if (fixBlock.includes('color: #f8fafc')) {
  throw new Error('Share link icon must not be forced to fixed white.');
}

console.log('dark share link visibility check passed');
