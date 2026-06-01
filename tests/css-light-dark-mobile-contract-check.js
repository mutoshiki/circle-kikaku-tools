const { readCssBundle, readText } = require('./helpers/read-project');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const css = readCssBundle();
const html = readText('index.html');

assert(html.includes('data-app-theme="single"'), 'single theme should be fixed on the document');
assert(!html.includes('data-theme-preset-list="light"') && !html.includes('data-theme-preset-list="dark"'), 'theme picker columns should be removed');
assert(css.includes('body[data-app-theme="single"]'), 'single theme tokens should be present');
assert(css.includes('@media (max-width: 390px)') || css.includes('@media (max-width: 430px)'), 'small mobile breakpoint should be present');
assert(css.includes('@media (max-width: 768px)'), 'general mobile breakpoint should be present');
assert(css.includes('--control-primary-text'), 'control text token should remain available');

console.log('CSS single-theme/mobile contract check OK');
