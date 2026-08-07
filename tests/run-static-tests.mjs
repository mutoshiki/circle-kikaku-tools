import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const walk = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => {
  const rel = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(rel) : [rel];
});
const appFiles = ['index.html', ...walk('assets/js').filter(f => f.endsWith('.js')), ...walk('assets/css').filter(f => f.endsWith('.css'))];
const source = appFiles.map(f => `\n/* ${f} */\n${read(f)}`).join('\n');
const checks = [];
const check = (name, fn) => {
  try { fn(); checks.push({ name, ok: true }); console.log(`PASS ${name}`); }
  catch (error) { checks.push({ name, ok: false, detail: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
};

check('Carbon package versions are exact', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.devDependencies['@carbon/web-components'], '2.60.0');
  assert.equal(pkg.devDependencies['@carbon/icons'], '11.85.0');
  assert.equal(pkg.devDependencies['@ibm/plex-sans'], '1.1.0');
  assert.equal(pkg.devDependencies['@ibm/plex-sans-jp'], '3.0.0');
});
check('Carbon runtime and IBM Plex assets exist', () => {
  ['assets/vendor/carbon/carbon-entry.min.js','assets/vendor/carbon/LICENSE-web-components.txt','assets/vendor/carbon/LICENSE-icons.txt','assets/vendor/ibm-plex/plex.css','assets/vendor/ibm-plex/LICENSE.txt','assets/vendor/ibm-plex/LICENSE-jp.txt'].forEach(rel => assert.ok(fs.existsSync(path.join(root, rel)), rel));
});
check('No Bootstrap or Font Awesome runtime dependency remains', () => {
  assert.doesNotMatch(source, /data-bs-|bootstrap\.|bootstrap(?:\.min)?\.(?:css|js)|fontawesome|font-awesome|\bfa-[a-z]/i);
});
check('No catch-all override files exist', () => {
  const bad = walk('.').filter(f => /(?:^|\/)(?:99-|override-|final-fix)/i.test(f));
  assert.deepEqual(bad, []);
});
check('No native generic form controls are emitted by app source', () => {
  const htmlAndJs = ['index.html', ...walk('assets/js').filter(f => f.endsWith('.js'))].map(read).join('\n');
  assert.doesNotMatch(htmlAndJs, /<(?:input|select|textarea|button)\b/i);
  assert.doesNotMatch(htmlAndJs, /createElement\(['"](?:input|select|textarea|button)['"]\)/i);
});
check('Every modal uses Carbon anatomy and a non-button primary focus target', () => {
  const html = read('index.html');
  const modals = [...html.matchAll(/<cds-modal\b[\s\S]*?<\/cds-modal>/gi)].map(m => m[0]);
  assert.ok(modals.length >= 10, `modal count ${modals.length}`);
  modals.forEach((modal, index) => {
    assert.match(modal, /<cds-modal-header\b/i, `header ${index}`);
    assert.match(modal, /<cds-modal-heading\b[^>]*data-modal-primary-focus/i, `focus heading ${index}`);
    assert.match(modal, /<cds-modal-close-button\b/i, `close ${index}`);
    assert.match(modal, /<cds-modal-body\b/i, `body ${index}`);
  });
});
check('Primary navigation and allocation mode use Carbon Content Switcher', () => {
  const html = read('index.html');
  assert.match(html, /<cds-content-switcher\b[^>]*id="view-toggle-bar"/i);
  assert.match(read('assets/js/core/data-state.js'), /<cds-content-switcher class="car-plan-template-tabs"/);
});
check('Header icon-only controls use Carbon Icon Button or Overflow Menu', () => {
  const html = read('index.html');
  ['editLockBtn','shareLinkBtn','overviewMenuBtn'].forEach(id => assert.match(html, new RegExp(`<cds-icon-button\\b[^>]*id="${id}"`, 'i')));
  assert.match(html, /<cds-overflow-menu\b[^>]*class="header-action"/i);
});
check('Waiting tray disclosure uses a Carbon button', () => {
  assert.match(read('index.html'), /<cds-button\b[^>]*id="tray-handle"/i);
});
check('Person actions use official Carbon Overflow Menu and Menu', () => {
  const cards = read('assets/js/features/person-cards.js');
  const menu = read('assets/js/features/person-menu.js');
  assert.match(cards, /<cds-overflow-menu\b[^>]*person-overflow-menu/);
  assert.match(cards, /<cds-menu\b[^>]*person-pop-menu/);
  assert.match(cards, /<cds-menu-item-group\b[^>]*slot="submenu"/);
  assert.doesNotMatch(menu, /positionPersonMenu|style\.setProperty\(['"]inset-/);
});
check('No automatic blocking coachmark remains', () => {
  assert.doesNotMatch(read('assets/js/features/sheet-view.js'), /maybeShowPlanningCoach/);
  assert.doesNotMatch(read('assets/css/components/feedback/01-assurance.css'), /\.app-coachmark/);
});
check('Input state owner includes Carbon invalid, warning, readonly and disabled contracts', () => {
  const forms = read('assets/css/tokens/04-forms-inputs.css');
  ['invalid','warn','readonly','disabled'].forEach(term => assert.match(forms, new RegExp(term, 'i')));
});

check('All required Carbon component modules are registered by the entry', () => {
  const entry = read('assets/js/carbon-entry.js');
  [
    'button/index.js', 'icon-button/index.js', 'content-switcher/index.js',
    'notification/toast-notification.js', 'tag/index.js', 'text-input/index.js',
    'select/index.js', 'checkbox/index.js', 'textarea/index.js',
    'number-input/index.js', 'toggle/index.js', 'modal/index.js',
    'overflow-menu/index.js'
  ].forEach(moduleName => assert.match(entry, new RegExp(moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
});
check('Lockfiles do not retain Bootstrap or Font Awesome', () => {
  const locks = ['package-lock.json', 'pnpm-lock.yaml'].filter(rel => fs.existsSync(path.join(root, rel))).map(read).join('\n');
  assert.doesNotMatch(locks, /(?:bootstrap|fontawesome|font-awesome)/i);
});
check('No inline JavaScript event handlers remain', () => {
  assert.doesNotMatch(read('index.html'), /\son[a-z]+\s*=/i);
});
check('Root Carbon geometry and mobile input zoom contract exist', () => {
  const type = read('assets/css/tokens/02-radius-spacing-type.css');
  const scheme = read('assets/css/tokens/01-color-scheme.css');
  const forms = read('assets/css/tokens/04-forms-inputs.css');
  assert.match(`${scheme}\n${type}`, /font-size:\s*16px/i);
  assert.match(forms, /max-width:\s*768px[\s\S]*font-size:\s*16px/i);
});
check('User guide screenshots are complete and current assets exist', () => {
  const dir = path.join(root, 'assets/images/user-guide');
  const images = fs.readdirSync(dir).filter(name => name.endsWith('.webp'));
  assert.equal(images.length, 11);
  images.forEach(name => assert.ok(fs.statSync(path.join(dir, name)).size > 1000, name));
});
check('Build manifest is deterministic and matches exact versions', () => {
  const manifest = JSON.parse(read('assets/vendor/carbon/build-manifest.json'));
  assert.equal(manifest.generatedAt, undefined);
  assert.deepEqual(manifest.versions, { webComponents: '2.60.0', icons: '11.85.0', plexSans: '1.1.0', plexSansJp: '3.0.0' });
});
check('Package scripts only reference available project test tools', () => {
  const pkg = JSON.parse(read('package.json'));
  ['test','test:ui','test:visual','test:carbon:complete','test:guard'].forEach(name => assert.ok(pkg.scripts[name], name));
  ['tests/run-static-tests.mjs','tests/carbon-complete.spec.js','tests/carbon-complete.visual.spec.js','tools/serve-static.mjs','playwright.config.js','stylelint.config.mjs'].forEach(rel => assert.ok(fs.existsSync(path.join(root, rel)), rel));
});

check('Index IDs are unique', () => {
  const ids = [...read('index.html').matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual([...new Set(dup)], []);
});
check('All local index references exist', () => {
  const refs = [...read('index.html').matchAll(/(?:href|src)="\.\/([^"?#]+)(?:[?#][^"]*)?"/g)].map(m => m[1]);
  const missing = refs.filter(rel => !fs.existsSync(path.join(root, rel)));
  assert.deepEqual(missing, []);
});


const failed = checks.filter(x => !x.ok);
fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
fs.writeFileSync(path.join(root, 'test-results/static-results.json'), JSON.stringify({ total: checks.length, passed: checks.length - failed.length, failed: failed.length, checks }, null, 2));
if (failed.length) process.exitCode = 1;
