const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.join(__dirname, '..', 'assets/css/app-shell/header/03-tabs-actions.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(css.includes('--header-action-size: 40px;'), 'desktop header action size should use one shared token');
assert(css.includes('--header-action-size: 42px;'), 'mobile header actions should be enlarged');
assert(css.includes('--header-icon-size: 1.25rem;'), 'mobile header icons should be enlarged');
assert(/\.header-action\s*\{[\s\S]*?border:\s*0;/.test(css), 'header actions should be borderless at the owner');
assert(!/#shareLinkBtn[^{]*\{/.test(css), 'share link must not have a separate visual rule');
assert(!/\.share-action[^{]*\{/.test(css), 'share action must inherit the shared header style');
console.log('Header icon contract check OK');
