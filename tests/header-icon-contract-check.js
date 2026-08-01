const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.join(__dirname, '..', 'assets/css/app-shell/header/03-tabs-actions.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(css.includes('--header-action-size: 48px;'), 'header actions should use a 48px minimum touch target');
assert(css.includes('--header-icon-size: 20px;'), 'header icons should use one shared Carbon-readable size');
assert(/\.header-action\s+:is\(i, \.carbon-icon\)/.test(css), 'header icon sizing must cover Font Awesome and Carbon during migration');
assert(/\.header-action\s*\{[\s\S]*?border:\s*0;/.test(css), 'header actions should be borderless at the owner');
assert(!/#shareLinkBtn[^{]*\{/.test(css), 'share link must not have a separate visual rule');
assert(!/\.share-action[^{]*\{/.test(css), 'share action must inherit the shared header style');
console.log('Header icon contract check OK');
