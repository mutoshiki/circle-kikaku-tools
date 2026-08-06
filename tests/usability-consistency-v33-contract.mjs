import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const html = read('index.html');
const viewport = read('assets/js/features/sheet/02-viewport-controls.js');
const ui = read('assets/js/modules/ui.js');
const batch = read('assets/js/features/batch-import.js');
const events = read('assets/js/features/events/05-view-feature-events.js');
const render = read('assets/js/core/render-controller.js');
const lock = read('assets/js/features/lock-protection.js');
const sheet = read('assets/js/features/sheet-view.js');
const tags = read('assets/js/core/tag-types.js');
const routeCss = read('assets/css/settlement/route-helper/01-route-shell.css');
const summaryCss = read('assets/css/settlement/summary/03-summary-colors.css');
const typeCss = read('assets/css/tokens/02-radius-spacing-type.css');
const drawerCss = read('assets/css/guides-modals/overview/01-overview-drawer.css');

assert.match(html, /id="sheet-fit-view-btn"[\s\S]*data-sheet-fit-label[\s\S]*全体表示/);
assert.match(viewport, /function resetSheetViewport[\s\S]*fitInitialSheetScale\(\{ fitAll \}\)/);
assert.match(viewport, /sheetScale = fitAll[\s\S]*Math\.min\(maxScale, fitScale\)/);
assert.match(viewport, /syncSheetFitControl[\s\S]*全体表示中/);
assert.match(events, /sheet-fit-view-btn/);

assert.match(ui, /function createModalStatus/);
assert.match(ui, /getOpenAppModalBody/);
assert.match(ui, /cds-inline-notification/);

assert.match(html, /id="batchRegistrationMode"/);
assert.match(html, /<cds-accordion class="batch-import-help-accordion"/);
assert.match(batch, /function setBatchRegistrationMode/);
assert.match(events, /cds-content-switcher-selected/);

assert.match(routeCss, /min-height:\s*clamp\(300px, 44dvh, 460px\)/);

assert.match(html, /id="editLockStatusTag"/);
assert.match(lock, /一部ロック/);
assert.match(lock, /全体ロック/);

assert.match(typeCss, /--font-size-caption:\s*0\.8125rem/);
assert.match(typeCss, /--font-size-micro:\s*0\.75rem/);
const cssFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.css') && !full.includes('share-thumbnail')) cssFiles.push(full);
  }
}
walk(path.join(root, 'assets/css'));
for (const file of cssFiles) {
  const css = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(css, /font-size:\s*(?:0\.[0-7][0-9]*rem|1[01]px)/, `${path.relative(root, file)} contains undersized text`);
}

assert.match(render, /sheet-summary-primary/);
assert.match(render, /sheet-summary-detail/);

assert.match(html, /<cds-select[^>]*id="seisanRounding"/);
assert.match(html, /<cds-select[^>]*id="seisanDriverRewardType"/);
const settingsStart = html.indexOf('id="settlementSettingsModal"');
const settingsEnd = html.indexOf('</cds-modal>', settingsStart);
assert.ok(settingsStart >= 0 && settingsEnd > settingsStart);
assert.doesNotMatch(html.slice(settingsStart, settingsEnd), /<cds-content-switcher\b/);

assert.match(tags, /male:\s*'cool-gray'/);
assert.match(tags, /female:\s*'warm-gray'/);

assert.match(summaryCss, /background:\s*var\(--surface-low\)/);
assert.doesNotMatch(summaryCss, /background:\s*var\(--settlement-(?:collect|club|pay)-bg\)/);

assert.match(html, /id="overviewDrawer"[^>]*role="dialog"[^>]*aria-modal="true"/);
assert.match(html, /id="overviewDrawerTitle"/);
assert.match(drawerCss, /overview-drawer-title/);

assert.match(lock, /<span>編集<\/span>/);
assert.doesNotMatch(read('assets/js/features/settlement/03-render.js'), /app-modal-heading-icon/);

assert.match(sheet, /地図を開く/);
assert.match(sheet, /リンクを開く/);

assert.ok(fs.existsSync(path.join(root, 'UI_FEEDBACK_RULES.md')));
assert.doesNotMatch(html + read('assets/js/templates/common-empty-state.js') + read('assets/js/templates/sheet-templates.js'), /参加者登録\(推奨\)/);
assert.match(read('assets/js/templates/common-empty-state.js'), /app-entry-recommended-tag/);

const appAssetRefs = [...html.matchAll(/(?:href|src)="(\.\/assets\/(?:css|js)\/[^"?]+)(?:\?v=([^" ]+))?"/g)];
assert.ok(appAssetRefs.length > 50);
for (const [, ref, version] of appAssetRefs) assert.equal(version, 'usability-v33', `${ref} has a mixed cache key`);

console.log('PASS usability and visual consistency v33 contract');
