const { readText, readCssBundle, readSettlementTemplateBundle } = require('./helpers/read-project');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const templates = readSettlementTemplateBundle();
const css = readCssBundle();

assert(templates.includes('function formatExtraSlash'), 'extras should have an inline formatter');
assert(templates.includes('function joinFormulaParts'), 'formula-style cost rows should use a shared join helper');
assert(templates.includes('seisan-extra-inline--offset') && templates.includes(" ? '−' : '＋'"), 'formula rows should show a minus before driver collection offsets and plus elsewhere');
assert(templates.includes('seisan-car-summary-headline'), 'car name and edit button should stay in one headline row');
assert(templates.includes('aria-label="車主への支払い金額"'), 'payment amount should be labeled as the amount paid to the car owner');
assert(templates.includes('function formatPaymentTotalRow') && templates.includes('seisan-cost-total-row'), 'payment total should render below all cost rows');
assert(templates.includes('<strong class="seisan-car-summary-name"><span>${esc(car.name, helpers)}</span><em>車</em></strong>'), 'driver name and 車 label should be separated for readability');
assert(!templates.includes('seisan-total-emphasis'), 'payment amount should not use the old separate emphasis block');
assert(!templates.includes('const extraTotal ='), 'extra total summary should not be displayed beside the expense label');
assert(!templates.includes('<span class="seisan-cost-preview-detail-text">割勘対象</span>'), 'gas cost should use the same simple split label style as extras');
assert(templates.includes("<span>ガソリン代</span><strong class=\"seisan-cost-line-amount seisan-car-summary-total ${UI_CLASS.amount}\">${money(calc.gas || 0, helpers)}</strong>${formatCostBadge('split')}"), 'gas cost should use the same amount class as the payment total');
assert(templates.includes('seisan-cost-preview-detail-text seisan-extra-inline-list'), 'cost details should be displayed inline inside the same cost preview UI');
assert(!templates.includes('<div class="seisan-extra-line-list">${formatExtraLines(extras, helpers)}</div>'), 'car summary should not render separate stacked extra lines');
assert(css.includes('.seisan-car-summary-headline') && css.includes('grid-template-columns: minmax(0, 1fr) 34px;'), 'headline should use one compact row for name and edit button');
assert(css.includes('.seisan-cost-preview-item') && css.includes('border: 0;'), 'car summary amount frames should be removed in the final override');
assert(css.includes('.seisan-cost-preview-item--inline-all'), 'gas and extra costs should render in one inline summary row');
assert(css.includes('.seisan-cost-total-row') && css.includes('border-top: 1px solid'), 'payment total should be separated from gas and extra rows by a divider');
assert(css.includes('.seisan-cost-line-amount.seisan-car-summary-total') && css.includes('--amount-font-size'), 'cost row amounts should follow the same visual amount rule as the payment total');

console.log('Settlement car summary readability check OK');
