const { readText } = require('./helpers/read-project');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const css = readText('assets/css/settlement/page-shell/04-mobile-layout.css');
const listCss = readText('assets/css/settlement/page-shell/03-car-summary-base.css');
const threeOrMoreSelector = '#seisan-view-area #seisan-car-list:has(> .seisan-car-summary-row:nth-child(3))';

assert(
  !css.includes(threeOrMoreSelector),
  'mobile car cost cards should not be compressed into a special two-column layout when three or more cars exist'
);
assert(
  !/\.seisan-car-summary-row\s*\+\s*\.seisan-car-summary-row/.test(css) && listCss.includes('#seisan-view-area #seisan-car-list { display: grid; gap: 10px; }'),
  'car list spacing should come from the canonical grid gap instead of per-card margins'
);

console.log('Settlement car list column check OK');
