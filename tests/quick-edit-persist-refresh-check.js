const fs = require('fs');
const path = require('path');

const dataState = fs.readFileSync(path.join(__dirname, '..', 'assets/js/core/data-state.js'), 'utf8');
const sheetView = fs.readFileSync(path.join(__dirname, '..', 'assets/js/features/sheet-view.js'), 'utf8');
const syncController = fs.readFileSync(path.join(__dirname, '..', 'assets/js/core/sync-controller.js'), 'utf8');
const headerEvents = fs.readFileSync(path.join(__dirname, '..', 'assets/js/features/events/02-static-header-events.js'), 'utf8');
const sheetCss = fs.readFileSync(path.join(__dirname, '..', 'assets/css/06-sheet-view.css'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

assert(dataState.includes('window.__suspendActiveDomPlanSync'), 'sheet quick edit commit must be able to suspend stale hidden DOM syncing.');
assert(dataState.includes('function getCarPlansSnapshot(options = {})'), 'getCarPlansSnapshot should accept options.');
assert(dataState.includes('skipDomSync'), 'data snapshots need a skipDomSync path for sheet rendering and saving.');
assert(dataState.includes('member = member || {};'), 'participant registry should ignore null empty seats from quick edit snapshots.');
assert(dataState.includes('renderActiveCarPlanToDom(options = {})'), 'active edit DOM renderer should accept options.');
assert(dataState.includes('if (!options.skipUpdate) updateUI();'), 'active edit DOM can be refreshed without recursively rerendering the sheet.');
assert(syncController.includes('getData({ skipDomSync: !!window.__suspendActiveDomPlanSync })'), 'save() must not clobber quick edit changes by reading stale hidden DOM.');
assert(sheetView.includes('sections.forEach(syncSheetSectionToPlan);'), 'quick edit completion should commit every visible plan, including car and team.');
assert(sheetView.includes("sectionRoot.querySelectorAll('.sheet-plan-section[data-plan-id]:not(.sheet-timetable-section)')"), 'quick edit commit should read only actual sheet allocation sections, not timetable or stale page elements.');
assert(sheetView.includes('renderActiveCarPlanToDom({ skipUpdate: true })'), 'quick edit completion should refresh the hidden edit DOM after committing sheet changes.');
assert(sheetView.includes('getData({ skipDomSync: true })'), 'sheet rendering should not sync from stale hidden edit DOM.');
assert(sheetView.includes('getCarPlansSnapshot({ skipDomSync: true })'), 'sheet plan rendering should use the committed plan data directly.');
assert(headerEvents.includes('function saveOverviewDraft(options = {})'), 'overview timetable draft saving should define options before reading skipRender.');
assert(sheetCss.includes('Quick sheet edit final polish'), 'quick edit CSS should include the readability repair block.');
assert(sheetCss.includes('body.quick-edit-mode #sheet-view-area :where(.sheet-chip, .sheet-chip-text)'), 'quick edit member names should stay fully opaque.');

console.log('Quick edit persist/refresh check OK');
