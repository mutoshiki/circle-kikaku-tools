const assert = require('assert');
const { readText } = require('./helpers/read-project');

const html = readText('index.html');
const sheetTemplates = readText('assets/js/templates/sheet-templates.js');
const sheetCss = readText('assets/css/sheet-view/layout/02-sheet-car-table.css');
const carTemplates = readText('assets/js/templates/settlement/03-car-cost-templates.js');
const carModalCss = readText('assets/css/settlement/car-inputs/04-edit-modal.css');
const shareCss = readText('assets/css/settlement/share/01-share-output.css');
const buttonBaseCss = readText('assets/css/components/buttons/01-button-base.css');
const appFrameCss = readText('assets/css/app-shell/layout/01-app-frame.css');
const routeStopsCss = readText('assets/css/settlement/route-helper/02-route-stops.css');

assert(sheetTemplates.includes("const groupTitle = `${cfg.type === 'team' ? '班' : '車'}${groupIndex + 1}`;"), 'shared sheet group headings should use 車1 / 班1 numbering');
assert(!sheetTemplates.includes('`第${groupIndex + 1}班`') && !sheetTemplates.includes('`${car.name}${cfg.groupSuffix}`'), 'legacy sheet heading formats should be removed');
assert(!sheetCss.includes('.sheet-capacity-badge.is-full {'), 'full capacity should not use a separate accent color');
assert(sheetCss.includes('.sheet-capacity-badge.is-over {'), 'over-capacity must remain a distinct error state');

assert(html.includes('class="seisan-btn" type="button" data-action="copy-settlement-text"'), 'copy action should use the shared quiet button surface');
assert(!html.includes('class="seisan-btn primary" type="button" data-action="copy-settlement-text"'), 'copy action should not use a filled primary surface');
assert(carTemplates.includes('class="seisan-btn seisan-distance-shortcut"'), 'distance helper should reuse the shared settlement button component');
assert(!carModalCss.includes('background: var(--app-accent') && !carModalCss.includes('.seisan-distance-shortcut:hover'), 'distance helper must not locally recreate a filled button');
assert(shareCss.includes('#seisan-view-area .seisan-share-actions .seisan-btn {'), 'share button layout should be owned by the share component');

assert(buttonBaseCss.includes(':is(.btn, .tool-btn, .tray-action-btn, .seisan-btn, .overview-mini-action, .overview-copy-action)'), 'common action surfaces should have one shared component rule');
assert(buttonBaseCss.includes(':focus-visible'), 'shared actions should expose one focus-visible contract');
assert(!appFrameCss.includes('data-priority="share"'), 'unused filled toolbar priority branch should be removed');
assert(!routeStopsCss.includes('.route-stop-card'), 'unused route stop card surface should be removed');

console.log('Shared UI unification check OK');
