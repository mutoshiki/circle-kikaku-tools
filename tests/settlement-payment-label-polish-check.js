const assert = require('assert');
const { readText, readCssBundle } = require('./helpers/read-project');

const templates = readText('assets/js/templates/settlement-templates.js');
const css = readCssBundle();

assert(!templates.includes('<span>集める</span>'), 'collect summary label should no longer say 集める');
assert(templates.includes("${formatCostBadge('split')}"), 'collect summary should use the shared 割勘 badge');
assert(templates.includes('1人 ${money(result.perPerson, helpers)} × ${result.payerCount}名'), 'collect summary sub text should remove the duplicated 割勘 label');
assert(!templates.includes('>渡す</div>'), 'summary label 渡す should be replaced');
assert(!templates.includes('<span>支払額</span>'), 'car summary should not use 支払額');
assert(templates.includes('>支払い</em>'), 'payment badge should say 支払い');
assert(templates.includes('function formatPaymentBadge'), 'shared payment badge helper should exist');
assert((templates.match(/formatPaymentBadge\(\)/g) || []).length >= 3, 'payment badge should be used by summary and car rows');
assert(css.includes('seisan-payment-tag'), 'payment badge CSS should exist');
assert(css.includes('var(--settlement-split-ink)') && css.includes('var(--settlement-club-ink)') && css.includes('var(--settlement-pay-ink)'), 'summary label text should use the same split/club/payment color tokens as car tags');

console.log('Settlement payment label polish check OK');
