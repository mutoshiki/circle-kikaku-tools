import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const menu = read('assets/js/features/person-menu.js');
const html = read('index.html');

assert.match(menu, /personMenuPointerGesture/, 'touch gesture state is missing');
assert.match(menu, /event\.pointerType === 'touch' \|\| event\.pointerType === 'pen'/, 'touch and pen activation fallback is missing');
assert.match(menu, /D\.addEventListener\('pointerup'/, 'pointerup fallback is not registered');
assert.match(menu, /moved > 10 \|\| elapsed > 900/, 'touch fallback does not distinguish taps from drags');
assert.match(menu, /suppressedPersonMenuClicks\.add\(trigger\)/, 'duplicate synthetic click guard is missing');
assert.match(menu, /else openCompactPersonMenu\(trigger\)/, 'touch fallback does not explicitly open the Carbon overflow menu');
assert.match(menu, /if \(personMenuItemFromEvent\(event\)\) return;/, 'menu-item touch actions are intercepted by the trigger fallback');
assert.match(html, /person-menu-touch-v35/, 'person-menu cache key was not advanced');

console.log('PASS v35 person menu touch activation contract');
