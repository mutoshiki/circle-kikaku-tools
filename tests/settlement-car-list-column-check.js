const { readText } = require('./helpers/read-project');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const css = readText('assets/css/settlement/page-shell/04-mobile-layout.css');
const threeOrMoreSelector = '#seisan-view-area #seisan-car-list:has(> .seisan-car-summary-row:nth-child(3))';

assert(css.includes(threeOrMoreSelector), 'three or more car cost cards should activate the compact grid');
assert(css.includes('grid-template-columns: repeat(2, minmax(0, 1fr));'), 'compact car cost grid should show two cards per row');
assert(
  css.includes(`${threeOrMoreSelector} .seisan-car-summary-row + .seisan-car-summary-row`) &&
    css.includes('margin-top: 0;'),
  'two-column cards should use grid gaps instead of stacked-card margins'
);

console.log('Settlement car list column check OK');
