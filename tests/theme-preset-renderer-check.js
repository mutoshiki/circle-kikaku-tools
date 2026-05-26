const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'assets/js/modules/theme-presets.js'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}


function extractPresetScopes() {
  const presets = [];
  const re = /scope:\s*['\"]([^'\"]+)['\"][\s\S]*?palette:\s*['\"]([^'\"]+)['\"]/g;
  let match;
  while ((match = re.exec(js))) presets.push({ scope: match[1], palette: match[2] });
  return presets;
}

assert(html.includes('assets/js/modules/theme-presets.js'), 'theme-presets.js is not loaded from index.html');
assert(html.indexOf('assets/js/modules/theme-presets.js') < html.indexOf('assets/js/app.js'), 'theme-presets.js must load before app.js');
assert(html.includes('data-theme-preset-list="dark"'), 'dark theme preset container missing');
assert(html.includes('data-theme-preset-list="light"'), 'light theme preset container missing');
assert(!html.includes('class="theme-preset-card"'), 'theme preset cards should not be hard-coded in index.html');
assert(js.includes('window.SanpoThemeRegistry'), 'theme registry should be exposed for appearance settings');
assert(js.includes('window.SanpoThemePresets'), 'theme preset data should be exposed for debugging');
assert(js.includes('function normalizePalette'), 'theme registry should own palette normalization');
assert(!fs.readFileSync(path.join(root, 'assets/js/features/appearance.js'), 'utf8').includes('const LIGHT_THEME_IDS'), 'appearance.js should not duplicate light theme ids');

const presets = extractPresetScopes();
const lightCards = presets.filter(preset => preset.scope === 'light').map(preset => preset.palette);
const darkCards = presets.filter(preset => preset.scope === 'dark').map(preset => preset.palette);
const lightAllowed = lightCards;
const darkAllowed = darkCards;

assert(lightCards.length > 0, 'light presets missing from renderer data');
assert(darkCards.length > 0, 'dark presets missing from renderer data');
assert(lightCards.length === 3, 'light preset count should stay at 3');
assert(darkCards.length === 3, 'dark preset count should stay at 3');
assert(new Set(lightCards).size === lightCards.length, 'light theme cards include duplicate palettes');
assert(new Set(darkCards).size === darkCards.length, 'dark theme cards include duplicate palettes');
assert(js.includes('idsByScope'), 'theme registry should derive allowed ids by scope');
assert(js.includes('labels'), 'theme registry should derive palette labels');

console.log('Theme preset renderer check OK');
