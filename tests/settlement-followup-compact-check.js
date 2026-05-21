const { readText, readCssBundle } = require('./helpers/read-project');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const templates = readText('assets/js/templates/settlement-templates.js');
const css = readCssBundle();

assert(templates.includes('seisan-car-summary-total') && templates.includes('seisan-payment-tag'), 'car summary should show payment amount in the headline with a 支払いタグ');
assert(templates.includes('seisan-cost-preview-item--gas') && templates.includes('seisan-cost-preview-item--extras'), 'gas and extra costs should use unified preview rows');
assert(templates.includes('seisan-extra-inline split') || templates.includes('seisan-extra-inline ${type}'), 'split/club status should be carried by inline extra markup');
assert(css.includes('.seisan-summary-pills--single') && css.includes('flex-wrap: nowrap'), 'settings summary should be one compact line');
assert(css.includes('.seisan-cost-type-badge.split') && css.includes('.seisan-cost-type-badge.club'), 'split and club colors should be clearly separated');
assert(css.includes('background: rgba(226, 232, 240, 0.10);'), 'edit car/team toggle should be quieter in dark theme');

console.log('Settlement follow-up compact check OK');
