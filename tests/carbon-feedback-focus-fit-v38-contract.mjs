import assert from 'node:assert/strict';
import fs from 'node:fs';

const route = fs.readFileSync('assets/js/features/settlement/04-route-helper.js', 'utf8');
const modal = fs.readFileSync('assets/js/core/modal-controller.js', 'utf8');
const render = fs.readFileSync('assets/js/features/settlement/03-render.js', 'utf8');
const events = fs.readFileSync('assets/js/features/events/04-settlement-input-events.js', 'utf8');
const templates = fs.readFileSync('assets/js/templates/settlement/04-extra-input-templates.js', 'utf8');

assert.match(route, /AppUI\?\.showStatus[\s\S]*移動距離に\$\{kilometers[\s\S]*tone:\s*'success'/, 'route apply uses the app Carbon success toast');
assert.match(route, /settlement\.cars\[targetName\]\.dist\s*=\s*String\(kilometers\)[\s\S]*showStatus[\s\S]*closePlanner/, 'success feedback occurs only after the distance has been committed');

assert.match(modal, /POINTER_COMMIT_CONTROLS[\s\S]*'cds-select'/, 'pointer focus normalization includes Carbon Select');
assert.match(modal, /if \(keyboardInteraction\) return null/, 'keyboard-originated focus is preserved');
assert.match(modal, /document\.addEventListener\('change', releasePointerCommittedFocus, true\)/, 'pointer selection commits release stale touch focus centrally');
assert.doesNotMatch(modal, /POINTER_COMMIT_CONTROLS[\s\S]*cds-text-input[\s\S]*\.join/, 'text-entry Carbon controls must not be blurred by the discrete-choice policy');

assert.match(templates, /<cds-text-input[^>]*density="condensed"[^>]*data-extra-field="name"/, 'expense name remains an official Carbon text input');
assert.match(render, /SETTLEMENT_EXTRA_NAME_MIN_FONT_PX\s*=\s*8/, 'name auto-fit has an explicit minimum for unusually long labels');
assert.match(render, /input\.style\.removeProperty\('font-size'\)/, 'auto-fit restores Carbon typography when the value becomes shorter');
assert.match(render, /input\.scrollWidth[\s\S]*input\.clientWidth/, 'auto-fit is based on actual rendered overflow, not a character-count heuristic');
assert.match(render, /fitSettlementExtraNameFields\(body\)/, 'rendered car editors immediately schedule name fitting');
assert.match(events, /target\.matches\('\[data-extra-field="name"\]'\)[\s\S]*fitSettlementExtraNameField/, 'name fitting is refreshed while typing');
assert.match(events, /sanpo:modal-shown[\s\S]*fitSettlementExtraNameFields/, 'name fitting is rechecked after modal layout becomes measurable');

console.log('Carbon feedback + pointer focus + expense-name auto-fit contract: PASS');
