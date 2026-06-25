const fs = require('fs');
const path = require('path');
const layering = fs.readFileSync(path.join(__dirname, '..', 'assets/css/app-shell/layout/04-layering.css'), 'utf8');
const menu = fs.readFileSync(path.join(__dirname, '..', 'assets/css/cars-members-tray/person-card/03-person-menu.css'), 'utf8');

function value(name) {
  const match = layering.match(new RegExp(`--z-${name}:\\s*(\\d+);`));
  return match ? Number(match[1]) : NaN;
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(value('person-menu') > value('tray'), 'person menu must appear above the waiting tray');
assert(value('person-menu') < value('modal-backdrop'), 'person menu must stay below modals');
assert(menu.includes('z-index: var(--z-person-menu);'), 'person menu must use the shared layer token');
assert(menu.includes('min-height: 44px;'), 'person menu items must provide a mobile touch target');
console.log('Person menu layer contract check OK');
