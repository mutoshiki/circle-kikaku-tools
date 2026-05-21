const { readCssBundle } = require('./helpers/read-project');

const css = readCssBundle();

const required = [
  '--theme-filled-control-text',
  '--header-icon-text',
  '#shareLinkBtn.header-action',
  '#routeHelperBtn.seisan-btn',
  '.seisan-btn.primary',
  '#shuffleAssignBtn.tray-action-btn',
  '#settlementCarEditModal .seisan-distance-shortcut',
  '-webkit-text-fill-color: var(--theme-filled-control-text)'
];

for (const token of required) {
  if (!css.includes(token)) {
    throw new Error(`Theme integrity patch is incomplete: missing ${token}`);
  }
}

console.log('Dark settlement readability check OK');
