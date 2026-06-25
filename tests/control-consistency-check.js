const fs = require('fs');
const path = require('path');
const { root, readText, readCssBundle } = require('./helpers/read-project');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const html = readText('index.html');
const css = readCssBundle();

assert(html.includes('./assets/css/08-utilities.css'), 'shared utility CSS should be loaded');
assert(!html.includes('/assets/css/visual/') && !fs.existsSync(path.join(root, 'assets/css/visual')), 'late visual override layer must not exist or be loaded');
assert(!html.includes('./assets/css/08-control-consistency.css'), 'legacy override dump should not be loaded');
assert(html.indexOf('./assets/css/07-drag-interactions.css') < html.indexOf('./assets/css/08-utilities.css'), 'utility CSS should load after drag CSS');
assert(css.includes('--control-radius: var(--radius-main)'), 'shared control radius token missing');
assert(css.includes('.header-action') && css.includes('.tool-btn') && css.includes('.seisan-btn') && css.includes('.tray-action-btn'), 'main action button selectors missing across owner CSS files');
assert(css.includes('#shuffleAssignBtn.tray-action-btn') && css.includes('#fillEmptySeatsBtn.tray-action-btn'), 'tray action priority selectors missing');
assert(css.includes('--control-primary-bg: var(--accent-color)'), 'single primary action token missing');
assert(!fs.existsSync(path.join(root, 'assets/css/08-control-consistency.css')), 'legacy 08 control dump should be deleted');

console.log('Control consistency check OK');
