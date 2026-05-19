const assert = require('assert');
const { readText, readCssBundle } = require('./helpers/read-project');

const state = readText('assets/js/features/settlement/01-state.js');
const calc = readText('assets/js/features/settlement/02-calculator.js');
const render = readText('assets/js/features/settlement/03-render.js');
const templates = readText('assets/js/templates/settlement-templates.js');
const share = readText('assets/js/features/settlement/06-share-text.js');
const css = readCssBundle();

assert(state.includes("const DRIVER_REWARD_EXTRA_NAME = '車出し協力代'"), 'driver reward extra name should be centralized');
assert(state.includes('function ensureDriverRewardExtra'), 'default driver reward should be injected through one helper');
assert(state.includes("extras.push({ name: DRIVER_REWARD_EXTRA_NAME, amount: String(rewardAmount), type: 'club' })"), 'default reward extra should be a club expense');
assert(render.includes('ensureDriverRewardExtra(state.cars?.[car.name] || {}, state)'), 'car edit modal should show the default reward extra');
assert(render.includes('ensureDriverRewardExtra(currentState.cars?.[car.name] || {}, currentState)'), 'car summary should use the same default reward extra');
assert(!calc.includes('rawPay = split + clubExtras + reward'), 'driver reward must not be added twice outside extras');
assert(calc.includes('const rawPay = split + clubExtras'), 'driver reward should be paid through club extras');
assert(calc.includes('isDriverReward: isDriverRewardExtra(ex)'), 'calculator should recognize reward extras separately for reporting');
assert(!share.includes('`協力代：${yen(car.reward)}`'), 'share text should not duplicate reward outside the extras list');
assert(templates.includes('function formatCostBadge') && templates.includes('seisan-cost-type-badge ${normalized}') && templates.includes("normalized === 'club' ? '部費' : '割勘'"), 'gas and extra rows should share the same cost tag component');
assert(templates.includes('function formatPaymentBadge') && templates.includes('seisan-payment-tag'), 'summary and car payment labels should use a shared 支払いタグ helper');
assert(css.includes('payment label polish: 支払も割勘/部費') && css.includes('--settlement-pay-bg') && css.includes('--settlement-pay-line'), 'payment label tag should have the same shape system as cost tags');
assert(css.includes('var(--settlement-split-bg)') && css.includes('var(--settlement-club-bg)'), 'split/club colors should remain tokenized');

console.log('Settlement reward extra and summary tag check OK');
