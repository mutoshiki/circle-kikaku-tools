const fs = require('fs');
const path = require('path');
const { root, readText } = require('./helpers/read-project');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

function activeCssFiles(dir) {
  const out = [];
  function walk(abs) {
    for (const name of fs.readdirSync(abs)) {
      if (name.startsWith('_')) continue;
      const p = path.join(abs, name);
      const rel = path.relative(root, p).replace(/\\/g, '/');
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.css')) out.push(rel);
    }
  }
  walk(path.join(root, dir));
  return out;
}

const appShell = readText('assets/css/01-app-shell.css');
const guides = readText('assets/css/03-guides-modals.css');
const theme = readText('assets/css/02-theme-appearance.css');

const appImports = [...appShell.matchAll(/@import url\(/g)].length;
const guideImports = [...guides.matchAll(/@import url\(/g)].length;

assert(appImports === 1, 'app shell should import a single active owner file');
assert(guideImports === 1, 'guides/modals should import a single active owner file');
assert(appShell.includes('./app-shell/01-app-shell-owner.css'), 'app shell owner import is missing');
assert(guides.includes('./guides-modals/01-guides-modals-owner.css'), 'guides/modals owner import is missing');

[
  'assets/css/app-shell/01-layout-core.css',
  'assets/css/app-shell/02-edit-controls.css',
  'assets/css/app-shell/03-header-room.css',
  'assets/css/app-shell/04-mobile-header.css',
  'assets/css/guides-modals/01-modal-dropdown-base.css',
  'assets/css/guides-modals/02-guide-cards.css',
  'assets/css/guides-modals/03-guide-mockups.css',
  'assets/css/guides-modals/04-modal-repairs.css'
].forEach(file => assert(!fs.existsSync(path.join(root, file)), `${file} should not remain as an active override owner`));

assert(!theme.includes('.guide-feature-card,'), 'guide feature cards must not be styled from theme appearance');

const guideFeatureOwners = activeCssFiles('assets/css')
  .filter(file => readText(file).includes('.guide-feature-card'));
assert(guideFeatureOwners.every(file => file === 'assets/css/guides-modals/01-guides-modals-owner.css'), `guide-feature-card has multiple active owners: ${guideFeatureOwners.join(', ')}`);

console.log('CSS fixed scope owner check OK');
