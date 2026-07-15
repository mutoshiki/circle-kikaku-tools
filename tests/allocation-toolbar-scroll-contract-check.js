const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'assets/css/app-shell/layout/02-panels.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const toolbarRule = css.match(/#top-area > \.edit-header:first-child,\s*\.allocation-toolbar\s*\{([^}]+)\}/)?.[1] || '';
assert(toolbarRule.includes('position: relative;'), 'allocation toolbar must participate in normal scrolling');
assert(!toolbarRule.includes('position: sticky;'), 'allocation toolbar must not follow the viewport');
assert(!toolbarRule.match(/(^|\s)top\s*:/), 'allocation toolbar must not retain a sticky top offset');
console.log('Allocation toolbar scroll contract check OK');
