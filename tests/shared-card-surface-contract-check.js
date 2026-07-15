const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.join(__dirname, '..', 'assets/css/cars-members-tray/01-shared-card-primitives.css'), 'utf8');
const shell = fs.readFileSync(path.join(__dirname, '..', 'assets/css/cars-members-tray/person-card/01-person-card-shell.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(css.startsWith('/* Shared member, driver and occupied-seat primitives.'), 'shared card owner must be active, not hidden by an unclosed comment');
assert(css.includes('#cars-container .seat-slot > .member-card,\n#waiting-list .member-card'), 'waiting and assigned cards must share one surface selector');
assert(css.includes('border: 1px solid var(--border-item);'), 'member cards must expose a Carbon subtle border');
assert(css.includes('background: var(--surface-low);'), 'shared cards must use a distinct Carbon layer token');
assert(css.includes('outline: 2px solid var(--focus-accent);'), 'member cards must expose a visible Carbon focus ring');
assert(css.includes('border-left-width: 1px;'), 'shared cards must keep a symmetric one-pixel border');
assert(!shell.includes('border-left-width:'), 'person-card layout owner must not redefine card border geometry');
console.log('Shared card surface contract check OK');
