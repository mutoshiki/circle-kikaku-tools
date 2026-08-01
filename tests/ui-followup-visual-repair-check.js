const { readCssBundle } = require('./helpers/read-project');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const css = readCssBundle();
assert(css.includes('--content-switcher-selected-bg'), 'Carbon content-switcher selected token missing');
assert(css.includes('.allocation-mode-toggle cds-content-switcher.car-plan-template-tabs'), 'car/team toggle must use the official Carbon Content Switcher host');
assert(css.includes('summary cost tags must keep their own chip surface'), 'summary tag chip ownership note missing');
assert(/\.seisan-cost-policy-tag\.split,[\s\S]*?--settlement-tag-bg:\s*var\(--settlement-split-bg\)/.test(css), 'summary split badge should keep split background token');
assert(/\.seisan-cost-policy-tag\.split,[\s\S]*?--settlement-tag-line:\s*var\(--settlement-split-line\)/.test(css), 'summary split badge should keep split border token');
assert(css.includes('The payment group in each car row should be plain text + badge'), 'car payment outer-frame ownership note missing');
assert(/#seisan-view-area \.seisan-car-summary-payment\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;/.test(css), 'car payment group should remain plain text plus badge');
console.log('UI follow-up visual repair check OK');
