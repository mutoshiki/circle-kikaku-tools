const { readCssBundle } = require('./helpers/read-project');
const css = readCssBundle();
const required = [
  'restore dark-mode readability after settlement summary color repairs',
  '--seisan-dark-surface-strong',
  '.seisan-summary-card.collect[data-summary-kind="collect"]',
  '.seisan-summary-card.accounting[data-summary-kind="club"]',
  '.seisan-summary-card.pay[data-summary-kind="pay"]',
  '.seisan-car-summary-row',
  '.seisan-cost-preview-item',
  '.seisan-payment-tag'
];
for (const token of required) {
  if (!css.includes(token)) {
    throw new Error(`Missing dark readability repair token: ${token}`);
  }
}
if (!css.includes('.seisan-car-summary-payment') || !css.includes('background: transparent;')) {
  throw new Error('Dark readability repair should keep the outer payment background transparent.');
}
console.log('Settlement dark readability follow-up check OK');
