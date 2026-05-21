const { readText, readCssBundle } = require('./helpers/read-project');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const css = readCssBundle();

assert(css.includes('--settlement-collect-bg:'), 'collect card should use a neutral background token');
assert(css.includes('#seisan-view-area .seisan-summary-card.collect') && css.includes('.seisan-mock-summary.collect'), 'collect neutral override should cover real and guide preview cards');
assert(css.includes('color: var(--text-main);'), 'collect label/value should return to normal text color');
assert(!css.includes('--settlement-collect-blue:'), 'old collect blue tokens should be removed');

console.log('Collect summary neutral check OK');
