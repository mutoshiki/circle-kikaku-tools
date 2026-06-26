const { readCssBundle } = require('./helpers/read-project');
const css = readCssBundle();
if (!css.includes('#seisan-view-area .seisan-summary-card:not(.collect):not(.accounting):not(.pay) {')) {
  throw new Error('Generic summary-card block must exclude semantic collect/accounting/pay cards.');
}
if (!css.includes('Split, club, and payment use the same surface algorithm.')) {
  throw new Error('Shared semantic summary color algorithm is missing.');
}
if (!css.includes('.seisan-summary-card.pay,') || !css.includes('--settlement-summary-bg: var(--settlement-pay-bg)')) {
  throw new Error('Payment summary must use the shared semantic surface variables.');
}
console.log('Settlement summary color guard OK');
