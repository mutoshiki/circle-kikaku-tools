import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('assets/css/cars-members-tray/car-card/03-seat-grid.css', 'utf8');
const tray = fs.readFileSync('assets/js/features/waiting-tray.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

assert.doesNotMatch(css, /content:\s*"空席\\A\s*メンバーを追加"/, 'empty seats must not render the old two-line copy');
assert.match(css, /\.seat-slot::before\s*\{\s*content:\s*none;\s*\}/, 'empty-seat pseudo copy is explicitly removed');
assert.match(css, /\.seat-slot:not\(:has\(> \.member-card\)\)[\s\S]*align-items:\s*center[\s\S]*justify-content:\s*center/, 'empty-seat add affordance is centered');
assert.match(css, /\.seat-add-btn > \.carbon-icon \{ width:\s*20px; height:\s*20px; \}/, 'Carbon add icon uses a balanced 20px size inside the icon button');

// v41 intentionally collapses the waiting tray only during drag, but the persisted
// `minimized` state must remain owned by the user. A transient class keeps those
// responsibilities separate and scrollTop is preserved across both resize edges.
assert.match(tray, /function preserveTopAreaScrollAcrossTrayResize[\s\S]*topArea\.scrollTop = scrollTop/, 'tray resize preserves the main scroll position');
assert.match(tray, /function prepareWaitingTrayForDrag[\s\S]*classList\.add\('drag-transient-minimized'\)/, 'drag start transiently collapses the tray');
const prepareStart = tray.indexOf('function prepareWaitingTrayForDrag');
const prepareEnd = tray.indexOf('function maybeOpenWaitingTrayNearPointer', prepareStart);
const prepare = tray.slice(prepareStart, prepareEnd);
assert.doesNotMatch(prepare, /classList\.add\('minimized'\)|classList\.remove\('minimized'\)/, 'drag start must not mutate persisted minimized state');
const finishStart = tray.indexOf('function finishWaitingTrayDragState');
const finish = tray.slice(finishStart);
assert.match(finish, /classList\.remove\('drag-transient-minimized'\)/, 'drag finish restores the open tray');
assert.doesNotMatch(finish, /classList\.(?:add|remove)\('minimized'\)/, 'drag finish must preserve user-selected minimized state');
assert.doesNotMatch(tray, /targets\[0\]\?\.scrollIntoView/, 'waiting-card highlighting must not scroll ancestor containers');
assert.match(tray, /const scroller = byId\('waiting-list-container'\)[\s\S]*scroller\.scrollTo/, 'waiting-card reveal is isolated to the tray scroller');

assert.match(index, /waiting-tray\.js\?v=root-stability-v44/, 'drag-related tray controller is cache-busted');

console.log('Card add affordance + transient drag tray contract: PASS');
