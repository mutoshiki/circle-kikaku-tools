const { readCssBundle, readText } = require('./helpers/read-project');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const css = readCssBundle();
const html = readText('index.html');

assert(html.includes('data-app-theme="standard"'), 'standard app theme should be fixed on first paint');
assert(html.includes('data-light-theme="standard"') && html.includes('data-dark-theme="standard"'), 'separated light/dark theme attributes should be present');
assert(html.includes('data-theme-preset-list="light"') && html.includes('data-theme-preset-list="dark"'), 'theme picker preset columns should be present');
assert(css.includes('body[data-app-theme="standard"]'), 'standard theme tokens should be present');
assert(css.includes('body[data-app-theme="spinel-light"]'), 'spinel-light theme tokens should be present');
assert(css.includes('body[data-app-theme="strawberry-matcha"]'), 'strawberry-matcha theme tokens should be present');
assert(css.includes('body[data-app-theme="earthbound-cave"]'), 'earthbound-cave theme tokens should be present');
assert(css.includes('body[data-app-theme="github-dark"]'), 'github-dark theme tokens should be present');
assert(css.includes('body[data-app-theme="night-owl-black"]'), 'night-owl-black theme tokens should be present');
assert(css.includes('body[data-app-theme="synthwave-84"]'), 'synthwave-84 theme tokens should be present');
assert(css.includes('@media (max-width: 390px)') || css.includes('@media (max-width: 430px)'), 'small mobile breakpoint should be present');
assert(css.includes('@media (max-width: 768px)'), 'general mobile breakpoint should be present');
assert(css.includes('--control-primary-text'), 'control text token should remain available');

console.log('CSS theme/mobile contract check OK');
