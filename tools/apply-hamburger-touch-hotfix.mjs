import { readFile, writeFile } from 'node:fs/promises';

async function replaceExact(path, before, after) {
  const source = await readFile(path, 'utf8');
  if (!source.includes(before)) {
    if (source.includes(after)) return false;
    throw new Error(`${path}: expected source pattern was not found`);
  }
  await writeFile(path, source.replace(before, after));
  return true;
}

let changed = false;

changed = await replaceExact(
  'assets/js/features/events.js',
  `        trigger.addEventListener('click', () => {\n            const expanded = Boolean(drawer.expanded || drawer.hasAttribute('expanded'));\n            setCarbonSideNavExpanded(!expanded);\n        });`,
  `        trigger.addEventListener('cds-header-menu-button-toggled', event => {\n            const next = Boolean(event.detail?.active);\n            setCarbonSideNavExpanded(next);\n        });`
) || changed;

changed = await replaceExact(
  'tests/official-carbon-ownership-contract.mjs',
  `assert.match(appEvents, /trigger\\.addEventListener\\('click', \\(\\) =>/);`,
  `assert.ok(!appEvents.includes("trigger.addEventListener('click'"), 'Carbon HeaderMenuButton must not be double-toggled by a host click listener');\nassert.match(appEvents, /trigger\\.addEventListener\\('cds-header-menu-button-toggled', event =>/);\nassert.match(appEvents, /const next = Boolean\\(event\\.detail\\?\\.active\\);/);`
) || changed;

changed = await replaceExact(
  'tests/official-carbon-runtime.spec.js',
  `  test.use({ viewport: { width: 390, height: 844 } });`,
  `  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });`
) || changed;

changed = await replaceExact(
  'tests/official-carbon-runtime.spec.js',
  `    await page.locator('#overviewMenuBtn').evaluate(node => node.click());`,
  `    await page.locator('#overviewMenuBtn').tap();`
) || changed;

changed = await replaceExact(
  'index.html',
  `./assets/css/app-shell/header/01-header-base.css?v=project-title-nav-v73`,
  `./assets/css/app-shell/header/01-header-base.css?v=hamburger-touch-v99`
) || changed;

changed = await replaceExact(
  'index.html',
  `./assets/css/app-shell/header/02-room-status.css?v=project-title-nav-v73`,
  `./assets/css/app-shell/header/02-room-status.css?v=title-restore-v99`
) || changed;

changed = await replaceExact(
  'index.html',
  `./assets/js/features/events.js?v=bug-report-nav-v74`,
  `./assets/js/features/events.js?v=hamburger-touch-v99`
) || changed;

changed = await replaceExact(
  '.github/workflows/quality-guard.yml',
  `      - run: npm run test:safari-sync\n      - name: WebKit participants mobile regression`,
  `      - run: npm run test:safari-sync\n      - name: WebKit hamburger touch regression\n        run: npx playwright test tests/official-carbon-runtime.spec.js --config=playwright.webkit.config.js\n      - name: WebKit participants mobile regression`
) || changed;

console.log(changed ? 'Hamburger touch hotfix applied.' : 'Hamburger touch hotfix already applied.');
