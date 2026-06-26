const { readText } = require('./helpers/read-project');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const tokens = readText('assets/css/tokens/05-control-surface-tokens.css');
const modal = readText('assets/css/guides-modals/modal/01-modal-base.css');
const dropdown = readText('assets/css/guides-modals/modal/02-dropdowns.css');
const personMenu = readText('assets/css/cars-members-tray/person-card/03-person-menu.css');
const trayShell = readText('assets/css/cars-members-tray/waiting-tray/01-tray-shell.css');
const trayStates = readText('assets/css/cars-members-tray/waiting-tray/05-tray-states.css');
const sheetSummary = readText('assets/css/sheet-view/layout/03-sheet-summary.css');
const settlementDensity = readText('assets/css/settlement/page-shell/06-density.css');
const settlementCost = readText('assets/css/settlement/cost-tags/02-cost-breakdown.css');

assert(tokens.includes('--ui-floating-backdrop:'), 'shared floating backdrop token is missing');
for (const [name, css] of [
  ['modal', modal],
  ['dropdown', dropdown],
  ['person menu', personMenu],
  ['waiting tray', trayShell],
]) {
  assert(css.includes('backdrop-filter: var(--ui-floating-backdrop);'), `${name} does not consume the shared backdrop token`);
}

for (const [name, css] of [
  ['sheet summary', sheetSummary],
  ['tray states', trayStates],
]) {
  assert(!css.includes('.modal-content'), `${name} must not style modal surfaces`);
  assert(!css.includes('.person-pop-menu'), `${name} must not style person menus`);
  assert(!css.includes('.dropdown-menu'), `${name} must not style dropdown surfaces`);
}

assert(!settlementDensity.includes('#cars-container'), 'settlement density must not style allocation cards');
assert(!settlementDensity.includes('#bottom-tray'), 'settlement density must not style the unassigned tray');
assert(!settlementCost.includes('#cars-container'), 'settlement cost tags must not style allocation cards');
assert(!dropdown.includes('var(--color-white)'), 'dropdown surface must use a semantic background token');
assert(!trayShell.includes('var(--color-white)'), 'waiting tray surface must use a semantic background token');

console.log('Floating surface owner check OK');
