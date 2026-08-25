import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('assets/js/app.js', 'utf8');
const workspace = fs.readFileSync('assets/js/features/assignment-workspace.js', 'utf8');
const personCards = fs.readFileSync('assets/js/features/person-cards.js', 'utf8');
const personMenu = fs.readFileSync('assets/js/features/person-menu.js', 'utf8');
const roleState = fs.readFileSync('assets/js/core/allocation-role-state.js', 'utf8');
const viewEvents = fs.readFileSync('assets/js/features/events/05-view-feature-events.js', 'utf8');
const css = fs.readFileSync('assets/css/cars-members-tray/assignment-workspace-refresh.css', 'utf8');
const mobileCss = fs.readFileSync('assets/css/app-shell/layout/03-mobile-frame.css', 'utf8');

assert.ok(!app.includes('setupManualCardDrag();'), 'Assignment card drag must not be initialized');
assert.ok(!workspace.includes('function ensureDragHandle'), 'Workspace must not create drag handles');
assert.ok(!workspace.includes('data-carbon-icon="draggable"'), 'Workspace must not render draggable affordances');
assert.ok(!workspace.includes('assignment-person-move-menu'), 'Workspace must not rebuild cross-car person move menus');
assert.ok(!workspace.includes('data-assignment-move-target'), 'Workspace must not create cross-car move targets');
assert.ok(workspace.includes('function concealWaitingPool()'), 'Workspace must explicitly conceal the legacy waiting drawer');
assert.match(css, /body\.assignment-workspace-enabled #bottom-tray\s*\{\s*display:\s*none;/s, 'Legacy waiting drawer must stay hidden in Assignment Workspace');
assert.match(css, /grid-template-areas:\s*"name meta menu"/, 'Member rows must not reserve a drag column');
assert.ok(css.includes('@media (max-width: 360px)'), 'Very narrow action wrapping must have an explicit tested breakpoint');

assert.ok(workspace.includes('const desired = [participantTab, carTab, teamTab, settlementTab]'), 'Primary destinations must be 参加者 → 車割 → 班割 → 精算');
assert.ok(!workspace.includes('assignmentTypeSwitcher'), 'Allocation-local 車割/班割 switcher must be removed');
assert.ok(!workspace.includes('assignmentWorkspaceTitle'), 'Redundant 車割・班割 workspace heading must be removed');
assert.ok(viewEvents.includes("bind('tab-list', () => openAllocationDestination('car'))"), '車割 tab must open the car allocation directly');
assert.ok(viewEvents.includes("bind('tab-team', () => openAllocationDestination('team'))"), '班割 tab must open the team allocation directly');

assert.ok(personCards.includes('data-person-action="driver"'), 'Person menu must expose the per-person driver role toggle');
assert.ok(!personCards.includes('data-person-action="name"'), 'Person name editing must be removed');
assert.ok(!personCards.includes('data-person-action="gender"'), 'Gender menu actions must be removed');
assert.ok(!personMenu.includes("action === 'name'"), 'Person menu handler must not support name editing');
assert.ok(!personMenu.includes("action === 'gender'"), 'Person menu handler must not support gender editing');
assert.ok(!personMenu.includes('setPersonGender'), 'Gender mutation functions must be removed from person menu behavior');

assert.ok(app.includes('allocation-role-state.js'), 'Allocation role compatibility/state owner must load before room restore');
assert.ok(roleState.includes("placement.driver"), 'Driver role must persist independently on participant placement');
assert.ok(roleState.includes("key === 'gender' || key === 'driverGender'"), 'Legacy gender fields must be stripped at state boundaries');
assert.ok(roleState.includes('member.driver = roleFromPlacement'), 'Projected members must restore their independent driver role');
assert.ok(workspace.includes('sortRoleRows(box)'), 'Role-tagged people must be sorted to the top of each group');

assert.ok(app.includes("document.documentElement.dataset.projectTitleRevealBound = 'true'"), 'Mobile must suppress the legacy gesture-driven project-title collapse owner');
assert.match(mobileCss, /#app-layout\s*\{[\s\S]*overflow-y:\s*auto;/, 'Mobile app layout must be the natural vertical scroll owner');
assert.match(mobileCss, /#top-area,[\s\S]*overflow:\s*visible;/, 'Mobile allocation content must not retain an independent vertical scroller');

console.log('assignment-workspace-drag-free-contract: OK');
