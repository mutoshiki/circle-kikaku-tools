const { readCssBundle, readText } = require('./helpers/read-project');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const css = readCssBundle();
const html = readText('index.html');

assert(css.includes('[data-theme="dark"]') || css.includes('body[data-theme="dark"]'), 'dark mode rules should be present');
assert(css.includes('color-scheme: dark'), 'dark color-scheme should be declared');
assert(css.includes('@media (max-width: 390px)') || css.includes('@media (max-width: 430px)'), 'small mobile breakpoint should be present');
assert(css.includes('@media (max-width: 768px)'), 'general mobile breakpoint should be present');
assert(html.includes('data-theme-preset-list="light"') && html.includes('data-theme-preset-list="dark"'), 'theme picker should keep light/dark columns');
assert(css.includes('--control-primary-text') && css.includes('--theme-filled-control-text'), 'control text tokens should cover light/dark filled buttons');

console.log('CSS light/dark/mobile contract check OK');
