const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'assets/js/features/person-menu.js'), 'utf8');
const events = fs.readFileSync(path.join(root, 'assets/js/features/events/03-generated-action-events.js'), 'utf8');

if (/person-pop-item[^`]*data-action/.test(app) || /data-action="\$\{action\}"/.test(app)) {
  throw new Error('Person menu must not use global data-action. Use data-person-action.');
}

if (!app.includes('data-person-action="${action}"')) {
  throw new Error('Person menu action buttons should use data-person-action.');
}

if (!app.includes('item.dataset.personAction')) {
  throw new Error('Person menu handler should read dataset.personAction.');
}

if (!events.includes("actionTarget.closest?.('.person-pop-menu')")) {
  throw new Error('Global data-action dispatcher should ignore person-pop-menu actions.');
}

console.log('person menu event namespace check passed');
