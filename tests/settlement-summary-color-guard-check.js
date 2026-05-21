const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.join(__dirname, '..', 'assets/css/settlement/02-summary-cards.css'), 'utf8');
if (!css.includes('#seisan-view-area .seisan-summary-card:not(.collect):not(.accounting):not(.pay) {')) {
  throw new Error('Generic summary-card block must exclude semantic collect/accounting/pay cards.');
}
if (!css.includes('Final guard: semantic settlement summary cards must keep their own colored surfaces.')) {
  throw new Error('Final semantic color guard block missing.');
}
if (!css.includes('html body #app-layout #seisan-view-area .seisan-summary-card.collect[data-summary-kind="collect"]')) {
  throw new Error('Collect semantic guard selector missing.');
}
console.log('Settlement summary color guard OK');
