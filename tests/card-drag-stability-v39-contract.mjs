import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('assets/css/cars-members-tray/car-card/03-seat-grid.css', 'utf8');
const tray = fs.readFileSync('assets/js/features/waiting-tray.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

assert.doesNotMatch(css, /content:\s*"空席\\A\s*メンバーを追加"/, 'empty seats must not render the old two-line copy');
assert.match(css, /\.seat-slot::before\s*\{\s*content:\s*none;\s*\}/, 'empty-seat pseudo copy is explicitly removed');
assert.match(css, /\.seat-slot:not\(:has\(> \.member-card\)\)[\s\S]*align-items:\s*center[\s\S]*justify-content:\s*center/, 'empty-seat add affordance is centered');
assert.match(css, /\.seat-slot-icon[\s\S]*width:\s*20px[\s\S]*height:\s*20px/, 'Carbon add icon uses a balanced 20px size');

assert.match(tray, /function prepareWaitingTrayForDrag\([\s\S]*Preserve the user's tray state instead/, 'drag preparation documents stable tray geometry');
const prepare = tray.match(/function prepareWaitingTrayForDrag\(\)\s*\{[\s\S]*?\n\}/)?.[0] || '';
assert.doesNotMatch(prepare, /classList\.add\('minimized'\)|classList\.remove\('minimized'\)/, 'drag start must not resize #top-area by changing tray height');
const near = tray.match(/function maybeOpenWaitingTrayNearPointer\([^)]*\)\s*\{[\s\S]*?\n\}/)?.[0] || '';
assert.doesNotMatch(near, /classList\.remove\('minimized'\)/, 'drag hover must not open the tray and resize the main scroller');
const finish = tray.match(/function finishWaitingTrayDragState\(\)\s*\{[\s\S]*?\n\}/)?.[0] || '';
assert.doesNotMatch(finish, /classList\.(?:add|remove)\('minimized'\)/, 'drag finish must preserve the user-selected tray state');
assert.doesNotMatch(tray, /targets\[0\]\?\.scrollIntoView/, 'waiting-card highlighting must not scroll ancestor containers');
assert.match(tray, /const scroller = byId\('waiting-list-container'\)[\s\S]*scroller\.scrollTo/, 'waiting-card reveal is isolated to the tray scroller');

assert.match(index, /03-seat-grid\.css\?v=card-drag-stability-v39/, 'seat styling is cache-busted');
assert.match(index, /waiting-tray\.js\?v=card-drag-stability-v39/, 'drag-related tray controller is cache-busted');

console.log('Card add affordance + drag scroll stability contract: PASS');
