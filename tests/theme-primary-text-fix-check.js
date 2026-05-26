const { readText, readCssBundle } = require('./helpers/read-project');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const css = readCssBundle();

assert(css.includes('--theme-filled-control-text: var(--control-primary-text);'), 'filled controls should use a theme-owned text token');
assert(css.includes('body[data-theme="dark"],'), 'dark mode should define control text separately from light mode');
assert(css.includes('--control-primary-text: color-mix(in srgb, var(--bg-body) 88%, #000000);'), 'dark filled-control text should be derived from the active dark palette background');
assert(css.includes('#routeHelperBtn.seisan-btn'), 'route calculation button should be covered by the filled-control repair');
assert(css.includes('#shuffleAssignBtn.tray-action-btn'), 'random assign button should be covered by the filled-control repair');
assert(css.includes('#settlementCarEditModal .seisan-distance-shortcut'), 'distance shortcut button should be covered by the filled-control repair');

const trayMobileCss = readText('assets/css/cars-members-tray/waiting-tray/04-tray-mobile.css');
assert(trayMobileCss.includes('#shuffleAssignBtn.tray-action-btn,\n.tray-inline-row .tray-action-btn--auto {\n    background: var(--control-primary-bg, var(--accent-color));'), 'random assign button should stay filled with the active theme color in its owner CSS');
assert(trayMobileCss.includes('background: var(--control-primary-hover, color-mix(in srgb, var(--accent-color) 88%, var(--color-black)));'), 'random assign hover state should use the active theme hover color');
assert(css.includes('-webkit-text-fill-color: var(--theme-filled-control-text);'), 'iOS/WebKit text fill should not remain fixed white');

console.log('Theme primary text fix check OK');
