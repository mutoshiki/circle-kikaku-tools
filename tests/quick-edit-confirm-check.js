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

assert(lockProtection.includes('function completeQuickEdit'), 'completeQuickEdit() must exist so quick edit can be finalized explicitly.');
assert(lockProtection.includes('syncSheetToMainData({ refresh: false, persist: false, syncHiddenDom: false })'), 'completeQuickEdit() should commit sheet DOM changes before leaving quick edit.');
assert(lockProtection.includes('persistSheetCommittedSnapshot();'), 'completeQuickEdit() should persist only after the rerender is validated.');
assert(lockProtection.includes('編集を保存しました。'), 'quick edit completion should show a saved notice.');
assert(lockProtection.includes('>完了'), 'active quick edit button should read 完了, not 編集中.');
assert(sheetView.includes('syncSheetToMainData({ refresh = true, persist = true } = {})'), 'syncSheetToMainData() should support non-rerender finalization.');
assert(sheetView.includes("currentView === 'sheet' && view !== 'sheet' && quickEditMode"), 'switching away from sheet should finalize quick edit first.');

console.log('Quick edit confirm check OK');
