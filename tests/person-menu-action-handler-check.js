const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'assets/js/app.js'), 'utf8');
const personMenu = fs.readFileSync(path.join(root, 'assets/js/features/person-menu.js'), 'utf8');
const events = fs.readFileSync(path.join(root, 'assets/js/features/events/03-generated-action-events.js'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const initBlock = app.match(/D\.addEventListener\('DOMContentLoaded',[\s\S]*?startHistoryAutosave\(\);/)?.[0] || '';
assert(initBlock.includes('setupCompactPersonMenu();'), 'compact person menu binding is missing from startup');
assert(initBlock.includes('ensureCompactMenuFallback();'), 'compact menu fallback binding is missing from startup');
assert(initBlock.indexOf('setupCompactPersonMenu();') < initBlock.indexOf('await initFirebaseSync();'), 'person menu binding must happen before Firebase/network startup');
assert(personMenu.includes('let activePersonMenuTarget = null;'), 'active person menu target state is missing');
assert(personMenu.includes('function handleCompactPersonAction('), 'shared person menu action handler is missing');
assert(personMenu.includes('window.handleCompactPersonAction = handleCompactPersonAction;'), 'person menu action handler must be exposed for fallback delegation');
assert(personMenu.includes('window.getActivePersonMenuTarget = getActivePersonMenuTarget;'), 'active person menu getter must be exposed for fallback delegation');
assert(personMenu.includes("handleEdit(isDriver ? 'driverMemo' : 'memo', targetPerson)"), 'memo action should open edit modal');
assert(personMenu.includes("handleEdit(isDriver ? 'driverName' : 'memberName', targetPerson)"), 'name action should open edit modal');
assert(events.includes("'[data-person-action]'"), 'generated-action event module should globally catch person menu item clicks');
assert(events.includes('global.handleCompactPersonAction?.('), 'generated-action event module should call shared person action handler');

console.log('Person menu action handler check OK');
