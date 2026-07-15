const assert = require('assert');
const { readText, readCssBundle, readSettlementTemplateBundle } = require('./helpers/read-project');

const css = readCssBundle();
const gestureCss = readText('assets/css/sheet-view/gestures/01-touch-navigation.css');
const quickEditCss = readText('assets/css/sheet-view/edit/01-quick-edit.css');
const trayActionsCss = readText('assets/css/cars-members-tray/waiting-tray/03-tray-actions.css');
const templates = readSettlementTemplateBundle();

assert(templates.includes('支払い額から差し引き済'), 'settlement setting summary wording should be updated');
assert(templates.includes("return formatCostBadge('pay', label);"), 'payment badge should reuse the shared cost-badge component');
assert(css.includes(`.sheet-summary-plan-label,\n.sheet-capacity-badge {`), 'sheet plan labels and capacity badges should share one visual rule');
assert(!css.includes('.sheet-summary-row.is-team .sheet-summary-plan-label'), 'team summary label should not have a separate design');
assert(!gestureCss.includes('#sheet-quick-edit-btn') && !gestureCss.includes('#sheet-bottom-controls'), 'gesture owner should not decorate quick-edit controls');
assert(quickEditCss.includes('#sheet-quick-edit-btn') && css.includes(`background: transparent;\n  box-shadow: none;`), 'quick-edit should keep one button surface on a transparent container');
assert(trayActionsCss.includes('background: color-mix(in srgb, var(--accent-color) 9%, var(--bg-card));'), 'random button should use a quiet accent-tinted surface');
assert(!trayActionsCss.includes('color: var(--color-white)'), 'waiting-tray actions should no longer use a filled white-on-accent treatment');

console.log('Requested root fixes check OK');
