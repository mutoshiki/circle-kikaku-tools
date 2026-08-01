const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const entry = fs.readFileSync(path.join(root, 'assets/js/carbon-entry.js'), 'utf8');
const bundle = fs.readFileSync(path.join(root, 'assets/vendor/carbon/carbon-entry.min.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const expectedVersions = {
  '@carbon/web-components': '2.60.0',
  '@carbon/icons': '11.85.0',
  '@ibm/plex-sans': '1.1.0',
  '@ibm/plex-sans-jp': '3.0.0'
};

Object.entries(expectedVersions).forEach(([name, version]) => {
  assert(pkg.devDependencies[name] === version, `${name} must stay pinned to ${version}`);
  assert(bundle.includes(version), `generated Carbon bundle must record ${name} ${version}`);
});

assert(entry.includes("@carbon/web-components/es/components/button/index.js"), 'official cds-button module must be imported');
assert(entry.includes("@carbon/web-components/es/components/icon-button/index.js"), 'official cds-icon-button module must be imported');
assert(entry.includes("@carbon/icons/es/"), 'official Carbon icon definitions must be imported');
assert(/<script type="module" src="\.\/assets\/vendor\/carbon\/carbon-entry\.min\.js\?v=2\.60\.0"><\/script>/.test(html), 'local Carbon module bundle must be loaded');
assert(html.includes('./assets/vendor/ibm-plex/plex.css'), 'local IBM Plex stylesheet must be loaded');

const migratedButtons = html.match(/<cds-(?:icon-)?button\b/g) || [];
assert(migratedButtons.length === 4, `Phase 2A must contain exactly four migrated Carbon buttons, found ${migratedButtons.length}`);
['shareLinkBtn', 'overviewMenuBtn', 'overviewDrawerCloseBtn', 'overviewTimetableAddBtn'].forEach(id => {
  assert(new RegExp(`<cds-(?:icon-)?button[^>]+id="${id}"`).test(html), `${id} must use an official Carbon button`);
});

[
  'assets/vendor/carbon/LICENSE-web-components.txt',
  'assets/vendor/carbon/LICENSE-icons.txt',
  'assets/vendor/ibm-plex/plex.css',
  'assets/vendor/ibm-plex/LICENSE.txt',
  'assets/vendor/ibm-plex/LICENSE-jp.txt',
  'assets/vendor/ibm-plex/fonts/IBMPlexSans-Regular.woff2',
  'assets/vendor/ibm-plex/fonts/IBMPlexSans-SemiBold.woff2',
  'assets/vendor/ibm-plex/fonts/IBMPlexSansJP-Regular.woff2',
  'assets/vendor/ibm-plex/fonts/IBMPlexSansJP-SemiBold.woff2'
].forEach(relativePath => {
  const file = path.join(root, relativePath);
  assert(fs.existsSync(file) && fs.statSync(file).size > 0, `${relativePath} must be generated locally`);
});

console.log('Carbon Phase 2A static contract check OK');
