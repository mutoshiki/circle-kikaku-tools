import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const state = read('assets/js/features/settlement/01-state.js');
const render = read('assets/js/features/settlement/03-render.js');
const calculator = read('assets/js/features/settlement/02-calculator.js');
const inputs = read('assets/js/templates/settlement/04-extra-input-templates.js');
const carTemplate = read('assets/js/templates/settlement/03-car-cost-templates.js');
const carFormCss = read('assets/css/settlement/car-inputs/01-car-form.css');
const timesCss = read('assets/css/settlement/car-inputs/06-times-rental.css');
const html = read('index.html');
const events = read('assets/js/features/events/05-view-feature-events.js');

assert.match(state, /driverRewardType:\s*'split'/, 'driver reward policy must default to split');
assert.match(state, /function normalizeDriverRewardType/, 'driver reward policy normalizer must exist');
assert.match(state, /ex\.type = rewardType/, 'generated driver reward extra must follow the selected policy');
assert.match(render, /filter\(ex => !isDriverRewardExtra\(ex\)\)/, 'driver reward must be hidden from per-car editor');
assert.match(calculator, /driverRewardType,/, 'calculation result must expose the selected policy');
assert.match(html, /<cds-select[^>]*id="seisanDriverRewardType"[^>]*value="split"/, 'settings must contain the default split Carbon Select');
assert.match(events, /rewardType\.addEventListener\('change'/, 'Carbon Select change must be handled');
assert.match(inputs, /data-extra-field="amount"[^>]*placeholder="金額"/, 'per-car amount placeholder must be 金額');
assert.doesNotMatch(inputs, /data-extra-field="amount"[^>]*placeholder="1000"/, 'old amount placeholder must be removed');

console.log('PASS driver reward policy contract');

assert.match(carTemplate, /seisan-gas-section-head[\s\S]*seisan-subhead--gas[\s\S]*seisan-times-toggle-field/, 'gas heading and Times toggle must share the compact section header');
assert.doesNotMatch(carTemplate, /seisan-car-inputs">\s*<div class="seisan-times-toggle-field/, 'Times toggle must not consume a separate form row');
assert.match(carFormCss, /grid-template-columns:\s*minmax\(0, 1fr\) auto/, 'gas header must keep title left and Times toggle right');
assert.match(timesCss, /justify-self:\s*end/, 'Times toggle must align to the upper right');
