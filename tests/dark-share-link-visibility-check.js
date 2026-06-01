const { readCssBundle } = require('./helpers/read-project');

const css = readCssBundle();

if (!css.includes('#shareLinkBtn.header-action') ||
    !css.includes('--header-icon-text') ||
    !css.includes('color: var(--header-icon-text)') ||
    !css.includes('-webkit-text-fill-color: var(--header-icon-text)')) {
  throw new Error('Dark mode share link icon is not normalized with the other header icons.');
}

if (css.includes('color: #f8fafc')) {
  throw new Error('Share link icon must not be forced to fixed white.');
}

console.log('dark share link visibility check passed');
