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

assert(light.includes('--accent-color: #0f62fe;'), 'light primary accent must use Carbon blue 60');
assert(dark.includes('--accent-color: #78a9ff;'), 'dark interactive accent must use Carbon blue 40');
assert(light.includes('--status-payment-text: #9f1853;'), 'payment role must use Carbon magenta 70');
assert(light.includes('--status-club-text: #684e00;'), 'club-expense role must use Carbon yellow 80');
assert(light.includes('--status-split-text: #001d6c;'), 'split role must use the Carbon blue family');
assert(!/#556b3e|#c2d5a1|palette-olive/i.test(runtime), 'the retired olive palette must not return');

console.log('Carbon v11 color system check OK');
