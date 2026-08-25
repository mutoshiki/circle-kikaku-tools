import assert from 'node:assert/strict';
import fs from 'node:fs';

const seatCss = fs.readFileSync('assets/css/cars-members-tray/car-card/03-seat-grid.css', 'utf8');
const workspaceCss = fs.readFileSync('assets/css/cars-members-tray/assignment-workspace-refresh.css', 'utf8');
const workspace = fs.readFileSync('assets/js/features/assignment-workspace.js', 'utf8');
const app = fs.readFileSync('assets/js/app.js', 'utf8');
const personCards = fs.readFileSync('assets/js/features/person-cards.js', 'utf8');

assert.doesNotMatch(seatCss, /content:\s*"空席\\A\s*メンバーを追加"/, 'empty seats must not render the old two-line pseudo copy');
assert.match(seatCss, /\.seat-slot::before\s*\{\s*content:\s*none;\s*\}/, 'empty-seat pseudo copy is explicitly removed');
assert.match(personCards, /class="seat-add-btn"/, 'empty seats keep an explicit Carbon add action');
assert.match(workspace, /label\.textContent = '空席'/, 'Assignment Workspace renders empty seats as real rows rather than blank space');
assert.match(workspaceCss, /#cars-container \.seat-slot:not\(:has\(> \.member-card\)\)[\s\S]*min-height:\s*3\.5rem/, 'empty seat rows keep the same nominal 56px row height');

assert.doesNotMatch(app, /setupManualCardDrag\(\)/, 'allocation card drag must not be initialized');
assert.doesNotMatch(workspace, /ensureDragHandle|data-carbon-icon="draggable"|className\s*=\s*['"]assignment-drag-handle|classList\.add\(['"]manual-drag-source/, 'Assignment Workspace must not create drag behavior or affordances');
assert.match(workspace, /querySelectorAll\('\.assignment-drag-handle,[^']*'\)\.forEach\(node => node\.remove\(\)\)/, 'Workspace may remove stale drag affordances left by older rendered DOM');
assert.match(workspace, /function concealWaitingPool\(\)/, 'the old waiting drawer is replaced by a hidden internal pool');
assert.match(workspaceCss, /#bottom-tray\s*\{\s*display:\s*none;/s, 'the lower waiting tray is never a visible allocation surface');

console.log('Non-drag allocation + explicit empty-seat contract: PASS');
