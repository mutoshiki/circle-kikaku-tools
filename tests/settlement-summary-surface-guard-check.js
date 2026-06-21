const { readCssBundle } = require('./helpers/read-project');
const css = readCssBundle();
const forbiddenSnippets = [
  '.driver-seat, .seat-slot, .member-card, .seisan-summary-card, .seisan-car-summary-row'
];
for (const snippet of forbiddenSnippets) {
  if (css.includes(snippet)) throw new Error('Settlement summary card is still included in a generic neutral surface group.');
}
if (!css.includes('.seisan-summary-card.collect') || !css.includes('.seisan-summary-card.accounting') || !css.includes('.seisan-summary-card.pay')) {
  throw new Error('Semantic summary card selectors are missing.');
}
console.log('Settlement summary surface guard OK');
