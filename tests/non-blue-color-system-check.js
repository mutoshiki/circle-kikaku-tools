const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const light = read('assets/css/tokens/01-color-scheme.css');
const dark = read('assets/css/tokens/01-theme-modes.css');
const palette = read('assets/css/tokens/01-component-palette.css');
const controls = read('assets/css/tokens/05-control-surface-tokens.css');
const runtime = [light, dark, palette, controls, read('assets/css/07-drag-interactions.css'), read('assets/css/cars-members-tray/drag-drop/01-card-drag.css')].join('\n');

assert(light.includes('--accent-color: #556b3e;'), 'light primary accent must use the olive system');
assert(dark.includes('--accent-color: #c2d5a1;'), 'dark primary accent must use the light olive system');
assert(light.includes('--status-payment-text: #733f56;'), 'payment role must use the wine family');
assert(light.includes('--status-club-text: #765318;'), 'club-expense role must use the ochre family');
assert(light.includes('--status-split-text: #365e43;'), 'split role must use the sage family');
assert(!/palette-blue|ui-blue|#3158c9|#b5c4ff|#60a5fa|49,\s*88,\s*201|96,\s*165,\s*250/i.test(runtime), 'old blue palette references must not return');

console.log('Non-blue color system check OK');
