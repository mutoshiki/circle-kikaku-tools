import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const state = read('assets/js/features/settlement/01-state.js');
const render = read('assets/js/features/settlement/03-render.js');
const events = read('assets/js/features/events/04-settlement-input-events.js');
const index = read('index.html');

assert.match(state, /function readSettlementExtraTypeControlValue/);
assert.match(state, /shadowRoot\?\.querySelector\?\.\('select'\)\?\.value/);
assert.match(state, /type: readSettlementExtraTypeControlValue\(exRow\.querySelector/);
assert.match(render, /commitLiveSettlementExtraTypeControls\(\);\s*syncSettlementStateFromDOM\(\);/);
assert.match(events, /readSettlementExtraTypeControlValue\(target, rawValue\)/);
assert.match(index, /01-state\.js\?v=settlement-negative-extra-save-v51/);
assert.match(index, /03-render\.js\?v=settlement-negative-extra-save-v51/);
assert.match(index, /04-settlement-input-events\.js\?v=settlement-negative-extra-save-v51/);

console.log('Settlement negative extra save v51 contract: PASS');
