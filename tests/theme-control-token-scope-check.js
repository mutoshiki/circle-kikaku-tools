const fs = require('fs');
const path = require('path');
const { root, readCssBundle } = require('./helpers/read-project');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const controlCss = readCssBundle();
const appShellOwnerPath = path.join(root, 'assets/css/app-shell/01-app-shell-owner.css');
const appShellOwner = fs.existsSync(appShellOwnerPath) ? fs.readFileSync(appShellOwnerPath, 'utf8') : '';

assert(/body\s*\{\r?\n\s+--control-border/.test(controlCss), 'control theme aliases should be recomputed on body');
assert(controlCss.includes('--control-primary-bg: var(--accent-color);'), 'primary control background should follow the active accent color');
assert(controlCss.includes('#batchOpenBtn.tool-btn span') && controlCss.includes('#shuffleAssignBtn.tray-action-btn i'), 'solid button child color safety selectors missing');
assert(controlCss.includes('color: var(--control-primary-text);'), 'solid button child text/icon color should use the primary text token');
assert(!appShellOwner.includes('/* Participant registration button: visible but not flashy. */'), 'stale participant registration override should not remain in app-shell owner');
assert(!appShellOwner.includes('/* Emphasize participant registration button like the share button. */'), 'duplicated participant registration override should not remain in app-shell owner');

console.log('Theme control token scope check OK');
