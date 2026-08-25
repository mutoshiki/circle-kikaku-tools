import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('assets/js/app.js', 'utf8');
const workspace = fs.readFileSync('assets/js/features/assignment-workspace.js', 'utf8');
const autoAssign = fs.readFileSync('assets/js/features/auto-assign.js', 'utf8');
const shareActions = fs.readFileSync('assets/js/features/share-actions.js', 'utf8');
const personCards = fs.readFileSync('assets/js/features/person-cards.js', 'utf8');
const personMenu = fs.readFileSync('assets/js/features/person-menu.js', 'utf8');
const roleState = fs.readFileSync('assets/js/core/allocation-role-state.js', 'utf8');
const viewEvents = fs.readFileSync('assets/js/features/events/05-view-feature-events.js', 'utf8');
const css = fs.readFileSync('assets/css/cars-members-tray/assignment-workspace-refresh.css', 'utf8');
const mobileCss = fs.readFileSync('assets/css/app-shell/layout/03-mobile-frame.css', 'utf8');

assert.ok(!app.includes('setupManualCardDrag();'), 'Assignment card drag must not be initialized');
assert.ok(!workspace.includes('function ensureDragHandle'), 'Workspace must not create drag handles');
assert.ok(!workspace.includes('data-carbon-icon="draggable"'), 'Workspace must not render draggable affordances');
assert.ok(!/createElement\([^)]*\)[\s\S]{0,180}assignment-person-move-menu/.test(workspace), 'Workspace must not rebuild cross-car person move menus');
assert.ok(!/createElement\([^)]*\)[\s\S]{0,180}data-assignment-move-target/.test(workspace), 'Workspace must not create cross-car move targets');
assert.ok(workspace.includes("person.querySelectorAll('.assignment-drag-handle, .assignment-person-move-menu, [data-assignment-move-target]').forEach(node => node.remove());"), 'Workspace must clean stale drag and move affordances rendered by older builds');
assert.ok(workspace.includes('function concealWaitingPool()'), 'Workspace must explicitly conceal the legacy waiting pool surface');
assert.ok(workspace.includes("if (child !== waitingContainer) child.remove();"), 'Visible waiting-tray controls must be removed while retaining only the internal pool container');
assert.match(css, /body\.assignment-workspace-enabled #bottom-tray\s*\{\s*display:\s*none;/s, 'Legacy waiting drawer must stay hidden in Assignment Workspace');
assert.match(css, /grid-template-areas:\s*"name meta menu"/, 'Member rows must not reserve a drag column');

assert.ok(workspace.includes('const desired = [participantTab, carTab, teamTab, settlementTab]'), 'Primary destinations must be 参加者 → 車割 → 班割 → 精算');
assert.ok(!workspace.includes('assignmentTypeSwitcher'), 'Allocation-local 車割/班割 switcher must be removed');
assert.ok(!workspace.includes('assignmentWorkspaceTitle'), 'Redundant 車割・班割 workspace heading must be removed');
assert.ok(workspace.includes('sheetTab?.remove()'), 'Legacy shared-view destination must be removed from the live DOM');
assert.ok(app.includes('installRetiredSheetViewCompatibility'), 'Only the legacy switchView implementation may receive an ephemeral compatibility node during a call');
assert.ok(viewEvents.includes("bind('tab-list', () => openAllocationDestination('car'))"), '車割 tab must open the car allocation directly');
assert.ok(viewEvents.includes("bind('tab-team', () => openAllocationDestination('team'))"), '班割 tab must open the team allocation directly');
assert.ok(!viewEvents.includes("bind('tab-sheet'"), 'Legacy shared-view tab must no longer own a navigation event');

assert.ok(personCards.includes('data-person-action="driver"'), 'Person menu must expose the per-person driver role toggle');
assert.ok(!personCards.includes('data-person-action="name"'), 'Person name editing must be removed');
assert.ok(!personCards.includes('data-person-action="gender"'), 'Gender menu actions must be removed');
assert.ok(!personMenu.includes("action === 'name'"), 'Person menu handler must not support name editing');
assert.ok(!personMenu.includes("action === 'gender'"), 'Person menu handler must not support gender editing');
assert.ok(!personMenu.includes('setPersonGender'), 'Gender mutation functions must be removed from person menu behavior');

assert.ok(app.includes('allocation-role-state.js'), 'Allocation role compatibility/state owner must load before room restore');
assert.ok(roleState.includes('placement.driver'), 'Driver role must persist independently on participant placement');
assert.ok(roleState.includes("key === 'gender' || key === 'driverGender'"), 'Legacy gender input must be discarded at state boundaries');
assert.ok(roleState.includes('member.driver = roleFromPlacement'), 'Projected members must restore their independent driver role');
assert.ok(workspace.includes('sortRoleRows(box)'), 'Role-tagged people must be sorted to the top of each group');

assert.ok(autoAssign.includes('async function autoAssign()'), 'Random assignment must be one parameterless bulk action');
assert.ok(autoAssign.includes("placement?.kind === 'member' && placement?.driver !== true"), 'Role-tagged drivers/leaders must keep their canonical allocation during random assignment');
assert.ok(autoAssign.includes('function isRandomlyMovablePlacement') && autoAssign.includes('randomSlotsFromCanonical'), 'Random assignment must update canonical placements instead of transient card DOM');
assert.ok(autoAssign.includes("title: 'ランダムに割り当て'"), 'Random allocation must use the requested wording');
assert.ok(autoAssign.includes("lastAutoAssignLabel = 'ランダムに割り当て';"), 'Persisted action label must match the visible random action');
assert.ok(!autoAssign.includes('optGrade') && !autoAssign.includes('assignByGrade') && !autoAssign.includes("mode === 'fill'"), 'Random allocation must have no condition or fill mode');
assert.ok(workspace.includes("'fillEmptySeatsBtn', 'traySettingsBtn', 'autoAssignPopover', 'autoAssignMenu', 'clearAllBtn', 'optFemale', 'optMale', 'optGrade'"), 'Retired bulk allocation controls must be removed from the live DOM');
assert.ok(!css.includes('traySettingsBtn') && !css.includes('autoAssignPopover') && !css.includes('auto-assign-menu-body'), 'Assignment owner CSS must not retain removed allocation-setting surfaces');
assert.ok(workspace.includes("id = 'assignmentWorkspaceAddGroupBtn'"), 'Assignment Workspace must expose an add-group action');
assert.ok(workspace.includes('function createGroupFromModal'), 'New car/team creation must be owned by the workspace lifecycle');
assert.ok(workspace.includes('data-assignment-group-action="delete"'), 'Each created group must remain removable from its Carbon menu');

assert.ok(shareActions.includes("url.searchParams.set('room', activeRoomId)"), 'Share must preserve the room id');
assert.ok(!shareActions.includes("url.searchParams.set('view'") && !shareActions.includes("url.searchParams.set('allocation'"), 'Share must not create a special car/team URL');
assert.ok(app.includes('normalizeLegacyAllocationShareUrl'), 'Old allocation-specific share URLs must normalize to the normal app');

assert.ok(app.includes("document.documentElement.dataset.projectTitleRevealBound = 'true'"), 'Mobile must suppress the legacy gesture-driven project-title collapse owner');
assert.match(mobileCss, /#app-layout\s*\{[\s\S]*overflow-y:\s*auto;/, 'Mobile app layout must be the natural vertical scroll owner');
assert.match(mobileCss, /#top-area,[\s\S]*overflow:\s*visible;/, 'Mobile allocation content must not retain an independent vertical scroller');

console.log('assignment-workspace-drag-free-contract: OK');
