import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const menu = read('assets/js/features/person-menu.js');
const menuCss = read('assets/css/cars-members-tray/person-card/03-person-menu.css');
const tray = read('assets/js/features/waiting-tray.js');
const focus = read('assets/css/tokens/02-radius-spacing-type.css');
const cards = read('assets/css/cars-members-tray/01-shared-card-primitives.css');
const sheet = read('assets/css/sheet-view/gestures/01-touch-navigation.css');
const batch = read('assets/css/guides-modals/import-guide/05-batch-help-flow.css');
const html = read('index.html');
const workflow = read('.github/workflows/quality-guard.yml');

assert.match(menu, /pendingPersonMenuActivation/, 'touch activation is not deferred behind Carbon click handling');
assert.match(menu, /openPersonChoiceSubmenu/, 'submenu parent activation guard is missing');
assert.match(menu, /event\.stopImmediatePropagation\(\)/, 'submenu activation can still close the overflow trigger');
assert.match(menu, /closePersonSubmenus\(trigger\)/, 'closed overflow menus can leave stale submenus visible');
assert.match(menu, /resetPersonMenuSurface\(trigger\.querySelector/, 'closed Carbon surfaces are not reset');
assert.match(menu, /updatePersonMenuScrollAffordance/, 'constrained menu scroll affordance state is missing');
assert.match(menuCss, /person-menu-scroll-indicator/, 'visible constrained-menu scroll affordance is missing');
assert.doesNotMatch(tray, /clampTraySettingsPopover/, 'allocation settings placement still overrides Carbon autoalign');
assert.match(focus, /body\.app-keyboard-navigation :where/, 'custom focus rings are not limited to keyboard modality');
assert.match(cards, /body\.app-keyboard-navigation #cars-container/, 'person-card focus outline still appears for pointer interaction');
assert.match(sheet, /body\.app-keyboard-navigation #sheet-canvas:focus-visible/, 'shared canvas focus outline still appears for pointer interaction');
assert.match(sheet, /#sheet-view-area\.sheet-needs-pan #sheet-canvas \{\s*box-shadow: none;/s, 'shared canvas still adds an accent edge shadow');
assert.doesNotMatch(batch, /box-shadow:[^;]*var\(--app-accent-border\)/, 'participant registration still uses blue scroll shadows');
assert.match(html, /ui-consistency-v36/, 'v36 cache key is missing');
assert.match(workflow, /actions\/checkout@v6/, 'checkout still uses the deprecated Node 20 action runtime');
assert.match(workflow, /actions\/setup-node@v6/, 'setup-node still uses the deprecated Node 20 action runtime');
assert.match(workflow, /actions\/upload-artifact@v6/, 'upload-artifact still uses the deprecated Node 20 action runtime');

console.log('PASS v36 submenu, placement and visual consistency contract');
