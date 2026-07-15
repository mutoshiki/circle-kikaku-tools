const { readCssBundle, readSettlementTemplateBundle } = require('./helpers/read-project');
function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}
const templates = readSettlementTemplateBundle();
const css = readCssBundle();
assert(templates.includes('seisan-cost-total-row') && templates.includes('seisan-car-summary-total') && templates.includes('seisan-payment-tag'), 'car summary should show payment amount below costs with a 支払タグ');
assert(templates.includes('seisan-cost-preview-item--gas') && templates.includes('seisan-cost-preview-item--extras'), 'gas and extra costs should use unified preview rows');
assert(templates.includes('seisan-cost-line ${type}') || templates.includes('seisan-extra-inline seisan-cost-line'), 'split/club status should be carried by inline cost markup');
assert(css.includes('.seisan-summary-pills--single') && css.includes('flex-wrap: nowrap'), 'settings summary should be one compact line');
assert(css.includes('.seisan-cost-type-badge.split') && css.includes('.seisan-cost-type-badge.club'), 'split and club colors should be clearly separated');
assert(css.includes('.allocation-mode-toggle .car-plan-template-tabs') && css.includes('background: color-mix(in srgb, var(--bg-card) 82%, var(--bg-body));'), 'edit car/team toggle should use the quiet single-system surface');
console.log('Settlement follow-up compact check OK');
