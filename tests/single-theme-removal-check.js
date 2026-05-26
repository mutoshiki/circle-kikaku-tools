const { readText } = require('./helpers/read-project');
const fs = require('fs');
const path = require('path');

const html = readText('index.html');
const appearance = readText('assets/js/features/appearance.js');

const mustNotAppear = [
  'appearanceSettingsBtn',
  'appearanceModal',
  'data-debug-theme-mode',
  'theme-presets.js',
  'テーマ設定'
];
const found = mustNotAppear.filter(token => html.includes(token));
if (found.length) {
  console.error('Theme UI was not fully removed from index.html:', found.join(', '));
  process.exit(1);
}

if (!html.includes('data-app-theme="single"') || !html.includes('data-theme="light"')) {
  console.error('Single-theme attributes are missing from index.html');
  process.exit(1);
}

if (!appearance.includes("D.body.dataset.appTheme = 'single'") || !appearance.includes("localStorage.removeItem(APPEARANCE_KEY)")) {
  console.error('Single-theme appearance compatibility shim is incomplete');
  process.exit(1);
}

for (const removedPath of [
  'assets/js/modules/theme-presets.js',
  'assets/css/theme/02-appearance-shell.css',
  'assets/css/theme/03-theme-picker.css',
  'assets/css/theme/04-theme-preview.css',
  'assets/css/theme/05-theme-mobile-dark.css',
  'assets/css/theme/06-theme-accessibility.css',
  'assets/css/theme/07-control-contrast.css'
]) {
  if (fs.existsSync(path.join(__dirname, '..', removedPath))) {
    console.error(`Removed theme file still exists: ${removedPath}`);
    process.exit(1);
  }
}

console.log('Single-theme removal check OK');
