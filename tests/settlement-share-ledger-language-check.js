const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'assets/js/features/settlement/06-share-text.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(source.includes('参加者集金：'), 'shared memo must use the same collection label as the summary');
assert(source.includes('部費支出') && source.includes('部費戻入'), 'shared memo must state the direction of club money');
assert(source.includes('支払総額：'), 'shared memo must use the same payment-total label as the summary');
assert(source.includes('ドライバー分の集金控除：'), 'shared memo must describe the driver collection deduction');
assert(source.includes("amount < 0 ? '−'"), 'shared memo must put the sign before the currency amount');
assert(!source.includes('集金：-${yen'), 'shared memo must not use the old mixed minus/currency notation');
console.log('Settlement share ledger language check OK');
