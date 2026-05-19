const { readText } = require('./helpers/read-project');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const css = readText('assets/css/08-control-consistency.css');

assert(css.includes('body[data-app-theme] {\n  --control-primary-text: #fff;\n}'), 'solid CTA text should stay white after theme changes');
assert(!css.includes('--control-primary-text: #111827;'), 'solid CTA text must not be forced to black');
assert(css.includes('body[data-app-theme="anthropic-warm"][data-theme="light"]'), 'warm light theme should have a readable solid-button background override');
assert(css.includes('--control-primary-bg: color-mix(in srgb, var(--accent-color) 82%, #111827);'), 'warm accent should be deepened instead of changing text to black');
assert(css.includes('body[data-app-theme="eight-bit"][data-theme="dark"]'), 'very bright green theme should have a stronger solid-button background override');

console.log('Theme primary text fix check OK');
