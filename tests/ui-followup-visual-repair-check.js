const { readText, readCssBundle } = require('./helpers/read-project');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const css = readCssBundle();
const carCss = readText('assets/css/cars-members-tray/04-car-card.css');
const summaryCss = readText('assets/css/settlement/05-checklists-share.css');
const settlementCss = readText('assets/css/settlement/02-summary-cards.css');

assert(carCss.includes('2026-05 repair: keep the car/team toggle active state on the theme accent'), 'car/team toggle repair should be documented in the car card CSS owner');
assert(/\.allocation-mode-toggle \.car-plan-template-chip\.active\s*\{[\s\S]*?background:\s*color-mix\(in srgb, var\(--accent-color\)/.test(carCss), 'light car/team active toggle must use the theme accent, not a fixed black background');
assert(!/\.allocation-mode-toggle \.car-plan-template-chip\.active,\s*\[data-theme="dark"\][^{]+\{[\s\S]*?background:\s*var\(--color-night\)/.test(carCss), 'car/team active toggle must not use a shared fixed black background');

assert(summaryCss.includes('summary cost tags must keep their own chip surface'), 'summary tag chip repair should be documented in the settlement owner CSS');
assert(/\.seisan-summary-card\.collect :is\(\.seisan-cost-policy-tag\.split, \.seisan-cost-type-badge\.split\)[\s\S]*?--settlement-tag-bg:\s*var\(--settlement-split-bg\)/.test(summaryCss), 'summary split badge should keep split background token');
assert(/\.seisan-summary-card\.collect :is\(\.seisan-cost-policy-tag\.split, \.seisan-cost-type-badge\.split\)[\s\S]*?--settlement-tag-line:\s*var\(--settlement-split-line\)/.test(summaryCss), 'summary split badge should keep split border token');

assert(settlementCss.includes('the payment group in each car row should be plain text + badge'), 'car payment outer frame repair should be documented in settlement summary CSS');
assert(/#seisan-view-area \.seisan-car-summary-payment,[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;/.test(settlementCss), 'car payment outer group should not have an extra background or border');
assert(css.includes('[data-theme="dark"] #seisan-view-area .seisan-car-summary-payment') && css.includes('background: transparent;'), 'dark mode car payment group should also be transparent');

console.log('UI follow-up visual repair check OK');
