import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const menu = read('assets/js/features/person-menu.js');
const featureEvents = read('assets/js/features/events/05-view-feature-events.js');
const menuCss = read('assets/css/cars-members-tray/person-card/03-person-menu.css');
const sheetGestureCss = read('assets/css/sheet-view/gestures/01-touch-navigation.css');
const html = read('index.html');

assert.match(menu, /personMenuPointerGesture/, 'touch gesture state is missing');
assert.match(menu, /event\.pointerType === 'touch' \|\| event\.pointerType === 'pen'/, 'touch and pen activation fallback is missing');
assert.match(menu, /D\.addEventListener\('pointerup'/, 'pointerup fallback is not registered');
assert.match(menu, /moved > 10 \|\| elapsed > 900/, 'touch fallback does not distinguish taps from drags');
assert.match(menu, /suppressedPersonMenuClicks\.add\(trigger\)/, 'duplicate synthetic click guard is missing');
assert.match(menu, /else openCompactPersonMenu\(trigger\)/, 'touch fallback does not explicitly open the Carbon overflow menu');
assert.match(menu, /if \(personMenuItemFromEvent\(event\)\) return;/, 'menu-item touch actions are intercepted by the trigger fallback');

assert.match(featureEvents, /setupPersonMenuMobileEvents/, 'menu-item touch fallback is not registered');
assert.match(featureEvents, /personMenuItemFromEvent\(event\) !== gesture\.item/, 'touch fallback does not verify the released menu item');
assert.match(featureEvents, /moved > 18 \|\| elapsed > 900/, 'menu-item fallback does not distinguish taps from menu scrolling');
assert.match(featureEvents, /gesture\.item\.click\(\)/, 'Carbon menu item activation is not replayed after an iOS tap');
assert.match(featureEvents, /event\.isTrusted/, 'duplicate native menu clicks are not guarded');
assert.match(featureEvents, /slot = 'tooltip-content'/, 'Carbon icon buttons do not use the official tooltip-content slot');
assert.doesNotMatch(featureEvents, /button\.setAttribute\('label'/, 'an unsupported icon-button label override remains');
assert.match(menuCss, /\.person-menu-scroll-hint/, 'the clipped menu has no visible scroll affordance');
assert.match(menuCss, /pointer-events: none/, 'the scroll affordance can block menu interaction');
assert.doesNotMatch(sheetGestureCss, /box-shadow:\s*inset[^;]+app-accent-border/s, 'the decorative blue sheet glow remains');
assert.match(html, /person-menu-touch-v35/, 'person-menu cache key was not preserved');

console.log('PASS v35 person menu touch activation contract');
