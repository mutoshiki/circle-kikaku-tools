import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const touchCss = read('assets/css/sheet-view/gestures/01-touch-navigation.css');
const frameCss = read('assets/css/sheet-view/layout/01-sheet-frame.css');
const viewportJs = read('assets/js/features/sheet/02-viewport-controls.js');
const baseCanvasRule = touchCss.match(/^#sheet-canvas\s*\{([^}]*)\}/m)?.[1] || '';

assert.match(touchCss, /@media \(max-width: 1055px\)[\s\S]*#sheet-view-area,[\s\S]*#sheet-canvas \{ touch-action: pan-y; \}/, 'responsive shared view delegates one-finger vertical gestures to native scrolling');
assert.match(touchCss, /@media \(min-width: 1056px\)[\s\S]*#sheet-canvas \{ touch-action: none; \}/, 'desktop direct pan/zoom remains explicitly scoped to wide viewports');
assert.match(frameCss, /#sheet-view-area[\s\S]*overflow-y: auto;[\s\S]*-webkit-overflow-scrolling: touch;/, 'responsive shared view remains the vertical scroll owner');
assert.match(touchCss, /sheet-has-more-below[\s\S]*mask-image: linear-gradient/, 'Carbon-style bottom fade communicates overflow');
assert.match(viewportJs, /function updateSheetScrollAffordance/, 'shared view tracks whether more content remains below');
assert.match(viewportJs, /area\.classList\.toggle\('sheet-has-more-below', hasMoreBelow\)/, 'overflow fade is removed when the scroll reaches the end');
assert.doesNotMatch(baseCanvasRule, /touch-action:\s*none/, 'touch-action none must not be unconditional on the shared canvas');

console.log('Shared touch scroll v72 contract: PASS');
