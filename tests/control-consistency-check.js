const { readText } = require('./helpers/read-project');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const html = readText('index.html');
const css = readText('assets/css/08-control-consistency.css');

assert(html.includes('./assets/css/08-control-consistency.css'), 'control consistency CSS should be loaded after drag CSS');
assert(html.indexOf('./assets/css/07-drag-interactions.css') < html.indexOf('./assets/css/08-control-consistency.css'), 'control consistency CSS should load last');
assert(css.includes('--control-radius: 10px'), 'moderate control radius token missing');
assert(css.includes('.header-action') && css.includes('.tool-btn') && css.includes('.seisan-btn') && css.includes('.tray-action-btn'), 'main action button selectors missing');
assert(css.includes('#shuffleAssignBtn.tray-action-btn') && css.includes('#fillEmptySeatsBtn.tray-action-btn'), 'tray action priority selectors missing');
assert(css.includes('[data-theme="dark"]'), 'dark theme consistency rules missing');

console.log('Control consistency check OK');
