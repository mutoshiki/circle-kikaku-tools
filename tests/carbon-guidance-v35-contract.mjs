import fs from 'node:fs';

const app = fs.readFileSync('assets/js/app.js', 'utf8');
const workspace = fs.readFileSync('assets/js/features/assignment-workspace.js', 'utf8');
const autoAssign = fs.readFileSync('assets/js/features/auto-assign.js', 'utf8');
const workspaceCss = fs.readFileSync('assets/css/cars-members-tray/assignment-workspace-refresh.css', 'utf8');

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

expect(app.includes("'fillEmptySeatsBtn', 'traySettingsBtn', 'autoAssignPopover', 'autoAssignMenu', 'clearAllBtn', 'optFemale', 'optMale', 'optGrade'"), 'Retired assignment-setting controls must be removed before feature startup.');
expect(workspace.includes('function removeRetiredAllocationControls()'), 'Assignment Workspace must own final cleanup of retired bulk-allocation controls.');
expect(workspace.includes("label.textContent = 'ランダムに割り当て'"), 'The only bulk action must be labelled 「ランダムに割り当て」.');
expect(autoAssign.includes('async function autoAssign()'), 'Random allocation must be a single parameterless action.');
expect(!autoAssign.includes('optGrade') && !autoAssign.includes('optFemale') && !autoAssign.includes('optMale'), 'Random allocation must not inspect assignment-condition controls.');
expect(!autoAssign.includes("mode === 'fill'") && !autoAssign.includes('assignByGrade'), 'Fill mode and condition-specific assignment algorithms must be retired.');
expect(!workspaceCss.includes('traySettingsBtn') && !workspaceCss.includes('autoAssignPopover') && !workspaceCss.includes('auto-assign-menu-body'), 'Assignment Workspace CSS must not style the retired settings surface.');
expect(app.includes('suppressRetiredAllocationDragGuidance'), 'The obsolete card-drag first-view guidance must be suppressed.');

console.log('Carbon assignment guidance contract: PASS');
