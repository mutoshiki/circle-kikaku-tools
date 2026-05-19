const { readText } = require('./helpers/read-project');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const templates = readText('assets/js/templates/settlement-templates.js');
const css = readText('assets/css/08-control-consistency.css');

assert(templates.includes('function formatExtraSlash'), 'extras should have an inline formatter');
assert(templates.includes('function joinSlashParts'), 'slash-separated cost rows should use a shared join helper');
assert(templates.includes(".join('<span class=\"seisan-extra-slash\" aria-hidden=\"true\">/</span>')"), 'gas and extra items should be separated with slash marks');
assert(templates.includes('seisan-car-summary-headline'), 'car name, payment amount, and edit button should be in one headline row');
assert(templates.includes('aria-label="車主への支払い金額"'), 'payment amount should be labeled as the amount paid to the car owner');
assert(templates.includes('<strong class="seisan-car-summary-name"><span>${esc(car.name, helpers)}</span><em>車</em></strong>'), 'driver name and 車 label should be separated for readability');
assert(!templates.includes('seisan-total-emphasis'), 'payment amount should not be rendered as a separate block');
assert(!templates.includes('const extraTotal ='), 'extra total summary should not be displayed beside the expense label');
assert(!templates.includes('<span class="seisan-cost-preview-detail-text">割勘対象</span>'), 'gas cost should use the same simple split label style as extras');
assert(templates.includes("<span>ガソリン代</span><strong>${money(calc.gas || 0, helpers)}</strong>${formatCostBadge('split')}"), 'gas cost should place its label, amount, and split badge inline like extra expenses');
assert(templates.includes('seisan-cost-preview-detail-text seisan-extra-inline-list'), 'cost details should be displayed inline inside the same cost preview UI');
assert(!templates.includes('<div class="seisan-extra-line-list">${formatExtraLines(extras, helpers)}</div>'), 'car summary should not render separate stacked extra lines');
assert(css.includes('compact SaaS settlement pass'), 'compact SaaS settlement CSS override block missing');
assert(css.includes('.seisan-car-summary-headline') && css.includes('grid-template-columns: minmax(0, 1fr) auto 34px;'), 'headline should use one compact row for name, payment, and edit button');
assert(css.includes('Settlement car summary: inline costs without amount frames') && css.includes('border: 0;'), 'car summary amount frames should be removed in the final override');
assert(css.includes('.seisan-cost-preview-item--inline-all'), 'gas and extra costs should render in one inline summary row');
assert(css.includes('.seisan-extra-inline-list') && css.includes('flex-wrap: wrap;'), 'extra details should wrap instead of being truncated on phones');
assert(css.includes('.seisan-car-summary-row .seisan-extra-slash') && css.includes('display: inline-flex;'), 'slash separators should be visible in car cost summaries');

console.log('Settlement car summary readability check OK');
