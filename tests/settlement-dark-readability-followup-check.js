const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.join(__dirname, '..', 'assets/css/settlement/05-checklists-share.css'), 'utf8');
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
if (/seisan-car-summary-payment[\s\S]*?background:\s*(?!transparent)/.test(css.slice(css.lastIndexOf('restore dark-mode readability')))) {
  throw new Error('Dark readability repair must not restore the removed outer payment background.');
}
console.log('Settlement dark readability follow-up check OK');
