const { readCssBundle } = require('./helpers/read-project');
const css = readCssBundle();
if (!css.includes('#seisan-view-area .seisan-summary-card:not(.collect):not(.accounting):not(.pay) {')) {
  throw new Error('Generic summary-card block must exclude semantic collect/accounting/pay cards.');
}
if (!css.includes('Final invariant: semantic settlement summary cards must keep their own colored surfaces.')) {
  throw new Error('Final semantic color invariant block missing.');
}
if (!css.includes('html body #app-layout #seisan-view-area .seisan-summary-card.collect[data-summary-kind="collect"]')) {
  throw new Error('Collect semantic guard selector missing.');
}
console.log('Settlement summary color guard OK');
