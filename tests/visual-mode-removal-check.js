const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'assets/js/app.js'), 'utf8');
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else files.push(full);
  }
}
walk(path.join(root, 'assets'));
const source = [html, app, ...files.filter(file => /\.(?:css|js)$/.test(file)).map(file => fs.readFileSync(file, 'utf8'))].join('\n');

for (const token of [
  'appearanceSettingsBtn',
  'appearanceModal',
  'data-app-theme',
  'data-light-theme',
  'data-dark-theme',
  'setDebugAppearanceMode',
  'SanpoThemeRegistry',
  'sanpo_color_mode_v1',
  'sanpo_app_theme'
]) {
  assert(!source.includes(token), `removed visual-mode feature token remains: ${token}`);
}

assert(!fs.existsSync(path.join(root, 'assets/js/features/appearance.js')), 'appearance feature file should be removed');
assert(!fs.existsSync(path.join(root, 'assets/js/modules/theme-presets.js')), 'preset registry should be removed');
assert(!fs.existsSync(path.join(root, 'assets/css/theme')), 'theme CSS directory should be removed');
assert(!fs.existsSync(path.join(root, 'assets/css/settlement/dark')), 'dark settlement CSS directory should be removed');
console.log('Visual mode removal check OK');
