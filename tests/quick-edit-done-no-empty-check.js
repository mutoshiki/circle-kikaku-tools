const fs = require('fs');
const path = require('path');

const lockProtection = fs.readFileSync(path.join(__dirname, '..', 'assets/js/features/lock-protection.js'), 'utf8');
const sheetView = fs.readFileSync(path.join(__dirname, '..', 'assets/js/features/sheet-view.js'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

assert(lockProtection.includes('const previousPlans = Array.isArray(carPlans) ? cloneData(carPlans) : [];'), 'quick edit completion should keep a plan backup before committing.');
assert(lockProtection.includes('syncHiddenDom: false'), 'quick edit completion should not let hidden edit DOM refresh blank the sheet before rerender.');
assert(lockProtection.includes('!hasPlanSection'), 'quick edit completion should detect accidental empty sheet renders.');
assert(lockProtection.includes('.sheet-plan-section[data-plan-id]:not(.sheet-timetable-section)'), 'quick edit completion should ignore timetable-only sections when checking for empty allocation tables.');
assert(lockProtection.includes("restorePreviousSheet('Quick edit render fallback restored previous sheet.');"), 'quick edit completion should restore the previous sheet if a blank render occurs.');
assert(sheetView.includes('function hasSheetPlanContent'), 'sheet commit should validate that committed plans still contain visible content.');
assert(sheetView.includes('Sheet quick edit commit produced an empty plan set'), 'sheet commit should reject empty plan corruption.');
assert(sheetView.includes('syncHiddenDom && typeof renderActiveCarPlanToDom'), 'hidden edit DOM refresh should be optional during quick edit completion.');
assert(sheetView.includes('function hasRenderedSheetPlanContent'), 'quick edit completion should validate rendered table content, not just section shells.');
assert(lockProtection.includes('hasRenderedSheetPlanContent(canvas)'), 'quick edit completion should reject blank rerenders before saving.');

console.log('Quick edit done no-empty check OK');
