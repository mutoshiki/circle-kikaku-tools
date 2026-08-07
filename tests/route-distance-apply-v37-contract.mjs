import assert from 'node:assert/strict';
import fs from 'node:fs';

const state = fs.readFileSync('assets/js/features/settlement/01-state.js', 'utf8');
const route = fs.readFileSync('assets/js/features/settlement/04-route-helper.js', 'utf8');
const sheet = fs.readFileSync('assets/js/features/sheet-view.js', 'utf8');
const render = fs.readFileSync('assets/js/core/render-controller.js', 'utf8');

assert.match(state, /function\s+getSettlementCarRowsForDomSync\s*\(/, 'DOM sync has an explicit authoritative-row resolver');
assert.match(state, /#seisan-car-list \.seisan-car-row/, 'main settlement list is the canonical DOM source');
assert.match(state, /settlementCarEditModal[\s\S]*open[\s\S]*settlementCarEditBody/, 'per-car editor rows are read only while the editor modal is open');
assert.doesNotMatch(state, /document\.querySelectorAll\(['"]\.seisan-car-row['"]\)\.forEach/, 'hidden preserved editor rows must not be globally synchronized');
assert.match(state, /getSettlementCarRowsForDomSync\(\)\.forEach/, 'settlement synchronization uses the authoritative-row resolver');

assert.match(route, /settlement\.cars\[targetName\]\.dist\s*=\s*String\(kilometers\)/, 'route apply writes the selected distance to settlement state');
assert.match(route, /renderSettlementView\(\{\s*force:\s*true\s*\}\);[\s\S]*save\(\);[\s\S]*closePlanner\(\{\s*apply:\s*true\s*\}\)/, 'route apply renders, persists, then returns to the car editor');

assert.match(sheet, /FIRST_VIEW_GUIDANCE_DELAY_MS\s*=\s*3000/, 'first-view guidance remains at the chosen three-second delay');
assert.match(sheet, /syawari_guidance_\$\{guidance\.keyPart\}_\$\{roomId\s*\|\|\s*['"]local['"]\}_v3/, 'guidance seen state is scoped per room and device');
assert.match(sheet, /roomHasRegisteredParticipants\(\)/, 'guidance eligibility derives from actual participants in the room');
assert.doesNotMatch(sheet, /registration_ready/, 'guidance no longer depends on a registration-complete flag from this device');
assert.match(render, /refreshFirstViewGuidanceEligibility/, 'room restore and remote updates re-evaluate first-view guidance');

console.log('Route distance apply + room guidance contract: PASS');
