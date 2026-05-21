const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.join(__dirname, '..', 'assets/css/settlement/05-checklists-share.css'), 'utf8');
const forbiddenSnippets = [
  '.driver-seat, .seat-slot, .member-card, .seisan-summary-card, .seisan-car-summary-row',
  '[data-theme="dark"] :where(.driver-seat, .seat-slot, .member-card, .sheet-driver-row, .sheet-seat-row, .sheet-wait-item, .seisan-summary-card'
];
for (const snippet of forbiddenSnippets) {
  if (css.includes(snippet)) {
    throw new Error('Settlement summary card is still included in a generic neutral surface group.');
  }
}
if (!css.includes('.seisan-summary-card.collect') || !css.includes('.seisan-summary-card.accounting') || !css.includes('.seisan-summary-card.pay')) {
  throw new Error('Semantic summary card selectors are missing.');
}
console.log('Settlement summary surface guard OK');
