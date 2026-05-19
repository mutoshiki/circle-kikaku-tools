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
assert(templates.includes('settlement-cost-surface split') && templates.includes('settlement-cost-surface club'), 'summary split/club surfaces should be marked explicitly');
assert(templates.includes('seisan-cost-type-badge split') && templates.includes('seisan-cost-type-badge club'), 'summary and rows should share the same tag component');
assert(css.includes('strict settlement cost surfaces') && css.includes('.settlement-cost-surface.split') && css.includes('.settlement-cost-surface.club'), 'summary surfaces should use the same split/club palette as tags');
assert(css.includes('var(--settlement-split-bg)') && css.includes('var(--settlement-club-bg)'), 'summary/card colors should come from the same split/club tokens');

console.log('Settlement reward extra and summary tag check OK');
