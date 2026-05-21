const { readText, readCssBundle } = require('./helpers/read-project');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const templates = readText('assets/js/templates/settlement-templates.js');
const css = readCssBundle();

assert(templates.includes('function formatExtraLines'), 'extra costs should render as simple lines, not only chips');
assert(templates.includes('seisan-car-summary-headline'), 'car summary should place name, payment, and edit action in one row');
assert(templates.includes('seisan-payment-tag') && templates.includes('seisan-car-summary-total'), 'car card should show a clear payment tag and value');
assert(css.includes('2026-05 repair: keep the car/team toggle active state on the theme accent') && css.includes('.allocation-mode-toggle .car-plan-template-chip.active') && css.includes('background: color-mix(in srgb, var(--accent-color) 12%, var(--bg-card));'), 'car/team active toggle should follow the theme accent instead of fixed black');
assert(css.includes('.seisan-extra-line-list') && css.includes('.seisan-extra-line'), 'extra costs should use simple line UI');
assert(css.includes('--ui-border-soft: color-mix(in srgb, var(--border-color) 44%, transparent);'), 'grey outline strength should be reduced globally');
assert(css.includes('.seisan-card,') && css.includes('border-color: transparent;'), 'card-like surfaces should not rely on visible grey outlines');

console.log('Final UI polish check OK');
