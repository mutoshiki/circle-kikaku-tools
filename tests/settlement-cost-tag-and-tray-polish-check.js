const { readText, readCssBundle } = require('./helpers/read-project');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const css = readCssBundle();

assert(css.includes('--settlement-split-ink') && css.includes('--settlement-club-ink'), 'split/club cost color tokens should be centralized');
assert(css.includes('.seisan-extra-inline > em') && css.includes('.seisan-cost-type-badge'), 'inline cost labels and badges should share the same pill UI');
assert(css.includes('--settlement-tag-min-width: 2.4em') && css.includes('border-radius: 999px'), 'split/club labels should have consistent pill dimensions');
assert(css.includes('.random-tools') && css.includes('grid-template-columns: minmax(92px, 1fr) auto'), 'bottom tray random/settings buttons should stay aligned in one row');
assert(css.includes('word-break: keep-all') && css.includes('overflow-wrap: normal'), 'summary yen values should not break on phones');

console.log('Settlement cost tag and tray polish check OK');
