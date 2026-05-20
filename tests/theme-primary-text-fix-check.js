const { readText } = require('./helpers/read-project');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const css = readText('assets/css/08-control-consistency.css');

assert(css.includes('2026-05 theme integrity repair'), 'final theme integrity repair block should exist');
assert(css.includes('--theme-filled-control-text: var(--control-primary-text);'), 'filled controls should use a theme-owned text token');
assert(css.includes('body[data-theme="dark"],'), 'dark mode should define control text separately from light mode');
assert(css.includes('--control-primary-text: color-mix(in srgb, var(--bg-body) 88%, #000000);'), 'dark filled-control text should be derived from the active dark palette background');
assert(css.includes('#routeHelperBtn.seisan-btn'), 'route calculation button should be covered by the filled-control repair');
assert(css.includes('#shuffleAssignBtn.tray-action-btn'), 'random assign button should be covered by the filled-control repair');
assert(css.includes('#settlementCarEditModal .seisan-distance-shortcut'), 'distance shortcut button should be covered by the filled-control repair');
assert(css.includes('-webkit-text-fill-color: var(--theme-filled-control-text);'), 'iOS/WebKit text fill should not remain fixed white');

console.log('Theme primary text fix check OK');
