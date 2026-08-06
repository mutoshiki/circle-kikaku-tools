import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const html = read('index.html');
const lock = read('package-lock.json');
const workflow = read('.github/workflows/quality-guard.yml');
const lockFeature = read('assets/js/features/lock-protection.js');
const personMenu = read('assets/js/features/person-menu.js');
const personMenuCss = read('assets/css/cars-members-tray/person-card/03-person-menu.css');
const layeringCss = read('assets/css/app-shell/layout/04-layering.css');
const sheetViewport = read('assets/js/features/sheet/02-viewport-controls.js');
const sheetGestureCss = read('assets/css/sheet-view/gestures/01-touch-navigation.css');
const capacityCss = read('assets/css/cars-members-tray/car-card/02-card-header.css');
const batchCss = read('assets/css/guides-modals/import-guide/05-batch-help-flow.css');
const batchFeature = read('assets/js/features/batch-import.js');

assert.doesNotMatch(lock, /internal\.api\.openai\.org|applied-caas-gateway/, 'private package registry URL remains');
assert.match(workflow, /Reject private registry URLs in lockfiles/, 'CI lockfile registry guard missing');
assert.doesNotMatch(html, /id="editLockStatusTag"/, 'header lock wording tag remains');
assert.match(html, /data-view-lock-scope="allocation"/, 'allocation tab lock icon missing');
assert.match(html, /data-view-lock-scope="settlement"/, 'settlement tab lock icon missing');
assert.doesNotMatch(html, /id="sheet-fit-view-btn"/, 'full view button remains');
assert.match(html, /id="sheet-gesture-hint"/, 'shared-view gesture hint missing');
assert.match(sheetGestureCss, /\.sheet-gesture-hint/, 'shared-view gesture hint styling missing');
assert.match(lockFeature, /view-tab--locked/, 'tab lock state sync missing');
assert.match(personMenu, /closePersonMenus\(\{ except: trigger \}\)/, 'single-open person menu guard missing');
assert.match(personMenu, /resetPersonMenuSurface/, 'stale menu surface reset missing');
assert.match(personMenu, /getPersonMenuViewportBounds/, 'person menu does not respect the scroll viewport bounds');
assert.match(personMenu, /top-area/, 'person menu top boundary does not account for the allocation scroller');
assert.match(personMenuCss, /overflow: visible;/, 'zero-size Carbon menu host can still clip its floating surface');
assert.match(layeringCss, /cds-overflow-menu:not\(\[open\]\) > cds-menu/, 'closed-only pointer event guard missing');
assert.match(layeringCss, /cds-overflow-menu\[open\] > cds-menu[\s\S]*pointer-events: auto;/, 'open Carbon person menus remain non-interactive');
assert.match(capacityCss, /font-size: 1\.25rem/, 'capacity edit emphasis not reduced');
assert.match(html, /data-horizontal-scroll-region/, 'horizontal table region missing');
assert.match(batchCss, /batch-auto-scroll-hint/, 'horizontal scroll affordance missing');
assert.match(batchFeature, /syncBatchAutoTableScrollAffordance/, 'horizontal scroll state sync missing');
assert.match(batchFeature, /initializeBatchAutoTableScrollAffordance/, 'horizontal scroll affordance is not initialized');
assert.match(batchFeature, /ResizeObserver/, 'horizontal scroll affordance does not remeasure rendered width');
assert.match(capacityCss, /--cds-link-primary: var\(--text-sub\)/, 'capacity editor retains primary-link emphasis');
for (const id of ['batchDrivers','batchGrade1','batchGrade2','batchGrade3','batchGrade4']) {
  const tag = html.match(new RegExp(`<cds-textarea[^>]*id="${id}"[^>]*>`, 's'))?.[0] || '';
  assert.doesNotMatch(tag, /placeholder=/, `${id} placeholder remains`);
}
const membersTag = html.match(/<cds-textarea[^>]*id="batchMembers"[^>]*>/s)?.[0] || '';
assert.match(membersTag, /placeholder=/, 'companion placeholder was removed');
assert.match(sheetViewport, /syncSheetGestureHint/, 'gesture hint state sync missing');
assert.doesNotMatch(html, /usability-v33/, 'stale cache key remains');

console.log('PASS v34 UI and CI registry contract');
