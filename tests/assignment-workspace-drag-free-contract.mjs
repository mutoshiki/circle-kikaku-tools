import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('assets/js/app.js', 'utf8');
const workspace = fs.readFileSync('assets/js/features/assignment-workspace.js', 'utf8');
const css = fs.readFileSync('assets/css/cars-members-tray/assignment-workspace-refresh.css', 'utf8');

assert.ok(!app.includes('setupManualCardDrag();'), 'Assignment card drag must not be initialized');
assert.ok(!workspace.includes('function ensureDragHandle'), 'Workspace must not create drag handles');
assert.ok(!workspace.includes('data-carbon-icon="draggable"'), 'Workspace must not render draggable affordances');
assert.ok(workspace.includes('function concealWaitingPool()'), 'Workspace must explicitly conceal the legacy waiting drawer');
assert.match(css, /body\.assignment-workspace-enabled #bottom-tray\s*\{\s*display:\s*none;/s, 'Legacy waiting drawer must stay hidden in Assignment Workspace');
assert.match(css, /grid-template-areas:\s*"name meta menu"/, 'Member rows must not reserve a drag column');
assert.ok(css.includes('@media (max-width: 360px)'), 'Very narrow action wrapping must have an explicit tested breakpoint');

console.log('assignment-workspace-drag-free-contract: OK');
