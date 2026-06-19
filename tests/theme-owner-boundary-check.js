const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const borderOwner = read('assets/css/theme/08-border-hierarchy.css');
const accentOwner = read('assets/css/theme/09-accent-application.css');
const html = read('index.html');

if (!borderOwner.includes('--app-line-soft:') || !borderOwner.includes('html[data-theme] body #app-layout :where(')) {
  console.error('Theme border owner must contain shared line tokens and cross-feature border rules');
  process.exit(1);
}

if (accentOwner.includes('--app-line-soft:') || accentOwner.includes('html[data-theme] body #app-layout :where(')) {
  console.error('Theme accent owner must not contain generic line or surface normalization');
  process.exit(1);
}

if (!accentOwner.includes('--theme-accent-fill:') || !accentOwner.includes('.appearance-mode-btn.active')) {
  console.error('Theme accent owner lost accent token or selected-control application');
  process.exit(1);
}

if (
  !html.includes('assets/css/theme/08-border-hierarchy.css') ||
  html.indexOf('assets/css/theme/08-border-hierarchy.css') > html.indexOf('assets/css/theme/09-accent-application.css')
) {
  console.error('Theme border hierarchy must load before accent application');
  process.exit(1);
}

console.log('Theme owner boundary check OK');
