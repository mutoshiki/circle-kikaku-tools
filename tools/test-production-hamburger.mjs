import { webkit } from 'playwright';

const url = process.env.PRODUCTION_URL || 'https://mutoshiki.github.io/circle-kikaku-tools/';
const browser = await webkit.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1'
});
const page = await context.newPage();
const consoleMessages = [];
page.on('console', msg => {
  if (['warning', 'error'].includes(msg.type())) consoleMessages.push(`${msg.type()}: ${msg.text()}`);
});
page.on('pageerror', err => consoleMessages.push(`pageerror: ${String(err)}`));

try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => customElements.get('cds-header-menu-button') && customElements.get('cds-side-nav'), null, { timeout: 15000 });
  await page.waitForSelector('#overviewMenuBtn');
  await page.waitForSelector('#overviewDrawer');

  const before = await page.evaluate(() => {
    const trigger = document.getElementById('overviewMenuBtn');
    const drawer = document.getElementById('overviewDrawer');
    const rect = drawer?.getBoundingClientRect();
    return {
      triggerTag: trigger?.tagName || '',
      drawerTag: drawer?.tagName || '',
      expanded: Boolean(drawer?.expanded || drawer?.hasAttribute('expanded')),
      drawerX: rect?.x ?? null,
      drawerWidth: rect?.width ?? null,
      drawerVisibility: drawer ? getComputedStyle(drawer).visibility : null,
      drawerTransform: drawer ? getComputedStyle(drawer).transform : null,
      eventsScript: [...document.scripts].find(s => s.src.includes('/assets/js/features/events.js'))?.src || '',
      headerCss: [...document.styleSheets].map(s => s.href || '').find(href => href.includes('/assets/css/app-shell/header/01-header-base.css')) || ''
    };
  });

  await page.locator('#overviewMenuBtn').tap({ timeout: 10000 });
  await page.waitForTimeout(500);

  const after = await page.evaluate(() => {
    const trigger = document.getElementById('overviewMenuBtn');
    const drawer = document.getElementById('overviewDrawer');
    const rect = drawer?.getBoundingClientRect();
    const style = drawer ? getComputedStyle(drawer) : null;
    return {
      expanded: Boolean(drawer?.expanded || drawer?.hasAttribute('expanded')),
      active: Boolean(trigger?.active || trigger?.hasAttribute('active')),
      ariaExpanded: trigger?.getAttribute('aria-expanded') || null,
      drawerX: rect?.x ?? null,
      drawerWidth: rect?.width ?? null,
      drawerHeight: rect?.height ?? null,
      drawerVisibility: style?.visibility ?? null,
      drawerDisplay: style?.display ?? null,
      drawerPointerEvents: style?.pointerEvents ?? null,
      drawerTransform: style?.transform ?? null
    };
  });

  console.log(JSON.stringify({ url: page.url(), before, after, consoleMessages }, null, 2));
  await page.screenshot({ path: 'production-hamburger-after.png', fullPage: false });

  if (!after.expanded) throw new Error('Side nav did not enter expanded state after a real touch tap.');
  if (after.drawerVisibility !== 'visible') throw new Error(`Side nav is expanded but visibility=${after.drawerVisibility}.`);
  if (after.drawerX === null || after.drawerX < -1 || after.drawerX > 2) throw new Error(`Side nav is expanded but off-canvas at x=${after.drawerX}.`);
  if (!after.drawerWidth || after.drawerWidth < 150) throw new Error(`Side nav width is invalid: ${after.drawerWidth}.`);
} finally {
  await browser.close();
}
