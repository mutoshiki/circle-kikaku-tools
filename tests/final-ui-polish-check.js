const { readCssBundle, readSettlementTemplateBundle } = require('./helpers/read-project');
function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}
const templates = readSettlementTemplateBundle();
const css = readCssBundle();
assert(templates.includes('function formatExtraLines'), 'extra costs should render as simple lines, not only chips');
assert(templates.includes('seisan-car-summary-headline'), 'car summary should place name, payment, and edit action in one row');
assert(templates.includes('seisan-payment-tag') && templates.includes('seisan-car-summary-total'), 'car card should show a clear payment tag and value');
assert(css.includes('.allocation-mode-toggle .car-plan-template-chip.active') && css.includes('var(--content-switcher-selected-bg)'), 'car/team active toggle should use the Carbon high-contrast selected state');
assert(css.includes('.seisan-extra-line-list') && css.includes('.seisan-extra-line'), 'extra costs should use simple line UI');
assert(css.includes('--ui-border-soft:') && css.includes('--border-item:'), 'quiet outline tokens should be centralized');
assert(css.includes('.seisan-card,') && css.includes('border: 1px solid var(--border-color);'), 'main card surfaces should use the shared border token');
console.log('Final UI polish check OK');
