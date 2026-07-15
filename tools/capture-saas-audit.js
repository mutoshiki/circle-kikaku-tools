const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(ROOT, process.argv[2] || 'screenshots/00-baseline');
const BROWSER = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/opt/playwright-chromium/chrome';
const BASE = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:4173/index.html';
const captureMode = process.env.CAPTURE_MODE || 'detailed';
const captureTheme = process.env.CAPTURE_THEME === 'dark' ? 'dark' : 'light';
const BASE_ORIGIN = new URL(BASE).origin;
const allSizes = [
  { name: 'mobile-small-360', width: 360, height: 800 },
  { name: 'mobile-standard-390', width: 390, height: 844 },
  { name: 'mobile-large-430', width: 430, height: 932 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 720 },
  { name: 'desktop-large-1440', width: 1440, height: 900 }
];
const widthFilter = process.env.CAPTURE_WIDTH ? Number(process.env.CAPTURE_WIDTH) : null;
const sizes = widthFilter ? allSizes.filter(size => size.width === widthFilter) : allSizes;
const keyWidths = new Set([390, 1280]);

fs.mkdirSync(OUT, { recursive: true });
const report = { generatedAt: new Date().toISOString(), theme: captureTheme, browser: '', screenshots: [], console: [], requestFailures: [], metrics: [] };

function local(rel) { return fs.readFileSync(path.join(ROOT, rel)); }
async function installRoutes(page) {
  await page.route('**/*', async route => {
    const url = route.request().url();
    try {
      if (url === 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css') {
        return route.fulfill({ status: 200, contentType: 'text/css', body: local('node_modules/bootstrap/dist/css/bootstrap.min.css') });
      }
      if (url === 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js') {
        return route.fulfill({ status: 200, contentType: 'application/javascript', body: local('node_modules/bootstrap/dist/js/bootstrap.bundle.min.js') });
      }
      if (url === 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css') {
        return route.fulfill({ status: 200, contentType: 'text/css', body: local('node_modules/@fortawesome/fontawesome-free/css/all.min.css') });
      }
      if (url.startsWith('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/')) {
        const name = path.basename(new URL(url).pathname);
        return route.fulfill({ status: 200, contentType: name.endsWith('.woff2') ? 'font/woff2' : 'application/octet-stream', body: local(`node_modules/@fortawesome/fontawesome-free/webfonts/${name}`) });
      }
      if (url === 'https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.0/Sortable.min.js') {
        return route.fulfill({ status: 200, contentType: 'application/javascript', body: local('node_modules/sortablejs/Sortable.min.js') });
      }
      if (url.endsWith('/firebase-config.js')) {
        return route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.SANPO_FIREBASE_CONFIG = {};' });
      }
      if (url.startsWith(`${BASE_ORIGIN}/`)) return route.continue();
      return route.abort('blockedbyclient');
    } catch (error) {
      report.requestFailures.push({ url, error: String(error) });
      return route.abort();
    }
  });
}
async function stabilize(page) {
  await page.addInitScript(() => {
    localStorage.clear();
    Date.now = () => 1767225600000;
    let n = 0;
    Math.random = () => 0.123456 + ((n++ % 7) * 0.000001);
  });
  await page.addStyleTag({ content: `
    *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
    html { scroll-behavior: auto !important; }
    body, body * { cursor: none !important; }
  ` });
}
async function gotoApp(page, suffix = 'AUDIT') {
  await page.goto(`${BASE}?room=${suffix}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => typeof window.executeDebugMode === 'function' && typeof window.switchView === 'function', null, { timeout: 30000 });
  await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; });
  await page.waitForTimeout(150);
}
async function seed(page, kind = 'normal') {
  await page.evaluate((kind) => {
    if (kind === 'missing') window.executeDebugMissingCostMode();
    else window.executeDebugMode();
  }, kind);
  await page.waitForTimeout(450);
  await page.evaluate(() => {
    document.querySelector('#mini-status-toast')?.classList.remove('visible');
    document.querySelectorAll('.modal-backdrop').forEach(e => e.remove());
    document.body.classList.remove('modal-open');
  });
}
async function switchView(page, view) {
  await page.locator(`#tab-${view}`).click();
  await page.waitForTimeout(100);
}
async function openHeaderMenu(page) {
  const toggle = page.locator('.header-more > button');
  await toggle.click();
  await page.locator('.header-more .dropdown-menu').waitFor({ state: 'visible' });
}
async function closeAllOverlays(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.modal.show').forEach(modal => {
      bootstrap.Modal.getInstance(modal)?.hide();
      modal.classList.remove('show');
      modal.style.display = 'none';
    });
    document.querySelectorAll('.modal-backdrop').forEach(e => e.remove());
    document.querySelector('.header-more .dropdown-menu')?.classList.remove('show');
    document.body.classList.remove('modal-open');
    document.querySelector('#overviewDrawer')?.classList.remove('open', 'show', 'is-open');
    document.querySelector('#overviewDrawer')?.setAttribute('aria-hidden', 'true');
    const scrim = document.querySelector('#overviewDrawerScrim'); if (scrim) scrim.hidden = true;
  });
}
function nameFor(state, size, position = 'top', dpr = 1) {
  return `${state}-saas-${size.name}-${size.width}x${size.height}-${position}-dpr${dpr}.png`;
}
async function metrics(page, state, size, scrollSelector) {
  const data = await page.evaluate(({ scrollSelector }) => {
    const doc = document.documentElement;
    const root = scrollSelector ? document.querySelector(scrollSelector) : null;
    const all = [...document.querySelectorAll('body *')].filter(el => {
      const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
      return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
    });
    const over = all.filter(el => {
      const r = el.getBoundingClientRect();
      return r.left < -1 || r.right > innerWidth + 1;
    }).slice(0, 20).map(el => ({ tag: el.tagName, id: el.id, cls: String(el.className).slice(0,120), left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right }));
    return {
      documentOverflowX: doc.scrollWidth > doc.clientWidth + 1,
      document: { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, scrollHeight: doc.scrollHeight, clientHeight: doc.clientHeight },
      root: root ? { selector: scrollSelector, scrollWidth: root.scrollWidth, clientWidth: root.clientWidth, scrollHeight: root.scrollHeight, clientHeight: root.clientHeight, overflowX: root.scrollWidth > root.clientWidth + 1, overflowY: root.scrollHeight > root.clientHeight + 1 } : null,
      offscreen: over
    };
  }, { scrollSelector });
  report.metrics.push({ state, variant: 'saas', size: size.name, ...data });
}
async function shot(page, state, size, scrollSelector = null, positions = ['top'], dpr = 1) {
  const root = scrollSelector ? page.locator(scrollSelector) : null;
  for (const position of positions) {
    if (root) {
      await root.evaluate((el, position) => {
        const max = Math.max(0, el.scrollHeight - el.clientHeight);
        el.scrollTop = position === 'bottom' ? max : position === 'mid' ? Math.floor(max / 2) : 0;
      }, position);
      await page.waitForTimeout(20);
    } else {
      await page.evaluate(position => {
        const max = Math.max(0, document.documentElement.scrollHeight - innerHeight);
        scrollTo(0, position === 'bottom' ? max : position === 'mid' ? Math.floor(max / 2) : 0);
      }, position);
      await page.waitForTimeout(20);
    }
    await page.evaluate(() => {
      ['mini-status-toast', 'copy-toast', 'app-notice', 'sheet-hint'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('visible');
      });
    });
    const filename = nameFor(state, size, position, dpr);
    await page.screenshot({ path: path.join(OUT, filename), fullPage: false, animations: 'disabled', caret: 'hide' });
    report.screenshots.push(filename);
  }
  await metrics(page, state, size, scrollSelector);
}

async function fullPageShot(page, state, size, scrollSelector = null, dpr = 1) {
  if (scrollSelector) {
    await page.locator(scrollSelector).evaluate(el => { el.scrollTop = 0; });
  }
  await page.evaluate(() => {
    ['mini-status-toast', 'copy-toast', 'app-notice', 'sheet-hint'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('visible');
    });
  });
  const filename = nameFor(state, size, 'fullpage', dpr);
  await page.screenshot({ path: path.join(OUT, filename), fullPage: true, animations: 'disabled', caret: 'hide' });
  report.screenshots.push(filename);
  await metrics(page, state, size, scrollSelector);
}

async function captureScenario(browser, size) {
  const dpr = 1;
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: dpr, colorScheme: captureTheme, reducedMotion: 'reduce', locale: 'ja-JP' });
  const page = await context.newPage();
  page.on('console', msg => { if (['error', 'warning'].includes(msg.type())) report.console.push({ size: size.name, variant: 'saas', type: msg.type(), text: msg.text(), location: msg.location() }); });
  page.on('pageerror', error => report.console.push({ size: size.name, variant: 'saas', type: 'pageerror', text: error.message }));
  page.on('requestfailed', request => {
    const url = request.url();
    if (!url.startsWith('data:')) report.requestFailures.push({ size: size.name, variant: 'saas', url, error: request.failure()?.errorText || '' });
  });
  await installRoutes(page);
  await stabilize(page);
  await gotoApp(page, `AUDIT-${size.width}-SAAS`);

  if (captureMode === 'fullpage') {
    await switchView(page, 'sheet');
    await fullPageShot(page, 'empty-sheet', size, '#sheet-canvas', dpr);
    await seed(page, 'normal');
    await switchView(page, 'list');
    await fullPageShot(page, 'list-car', size, '#top-area', dpr);
    await switchView(page, 'sheet');
    await fullPageShot(page, 'sheet', size, '#sheet-canvas', dpr);
    await switchView(page, 'seisan');
    await fullPageShot(page, 'settlement', size, '#seisan-view-area', dpr);
    await context.close();
    return;
  }

  const key = keyWidths.has(size.width);
  const positions = key ? ['top', 'mid', 'bottom'] : ['top'];

  await switchView(page, 'sheet');
  await shot(page, 'empty-sheet', size, '#sheet-canvas', ['top'], dpr);

  await seed(page, 'normal');
  await switchView(page, 'list');
  await shot(page, 'list-car', size, '#top-area', positions, dpr);
  await switchView(page, 'sheet');
  await shot(page, 'sheet', size, '#sheet-canvas', positions, dpr);
  await switchView(page, 'seisan');
  await shot(page, 'settlement', size, '#seisan-view-area', positions, dpr);

  if (key) {
    await switchView(page, 'list');
    const teamButton = page.locator('#car-plan-switcher .car-plan-template-chip').filter({ hasText: '班割' });
    if (await teamButton.count()) { await teamButton.click(); await page.waitForTimeout(100); }
    await shot(page, 'list-team', size, '#top-area', positions, dpr);

    await switchView(page, 'sheet');
    await page.locator('#sheet-quick-edit-btn').click();
    await page.waitForTimeout(120);
    await shot(page, 'sheet-quick-edit', size, '#sheet-canvas', positions, dpr);

    await closeAllOverlays(page);
    await page.locator('#overviewMenuBtn').click();
    await page.waitForTimeout(100);
    await shot(page, 'overview-drawer', size, '#overviewDrawer .overview-drawer-body', ['top', 'bottom'], dpr);
    await page.locator('#overviewDrawerCloseBtn').click();

    await openHeaderMenu(page);
    await shot(page, 'header-menu', size, null, ['top'], dpr);
    await page.locator('.header-more > button').click();

    await switchView(page, 'list');
    await page.locator('#batchOpenBtn').click();
    await page.locator('#batchImportModal').waitFor({ state: 'visible' });
    await shot(page, 'batch-import-modal', size, '#batchImportModal .modal-body', ['top', 'mid', 'bottom'], dpr);
    await closeAllOverlays(page);

    await openHeaderMenu(page); await page.locator('#userGuideBtn').click();
    await page.locator('#userGuideModal').waitFor({ state: 'visible' });
    await shot(page, 'user-guide-modal', size, '#userGuideModal .modal-body', ['top', 'mid', 'bottom'], dpr);
    await closeAllOverlays(page);

    await switchView(page, 'seisan');
    await page.locator('[data-action="open-settlement-settings"]').click();
    await page.locator('#settlementSettingsModal').waitFor({ state: 'visible' });
    await shot(page, 'settlement-settings-modal', size, '#settlementSettingsModal .modal-body', ['top', 'bottom'], dpr);
    await closeAllOverlays(page);

    await page.locator('#seisan-car-list [data-action="open-settlement-car-edit"]').first().click();
    await page.locator('#settlementCarEditModal').waitFor({ state: 'visible' });
    await shot(page, 'settlement-car-modal', size, '#settlementCarEditModal .modal-body', ['top', 'mid', 'bottom'], dpr);
    const routeButton = page.locator('#settlementCarEditModal [data-action="open-route-helper-shortcut"]');
    if (await routeButton.count()) {
      await routeButton.click();
      await page.locator('#routeDistanceModal').waitFor({ state: 'visible' });
      await shot(page, 'route-helper-modal', size, '#routeDistanceModal .modal-body', ['top', 'bottom'], dpr);
    }
    await closeAllOverlays(page);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.executeDebugMissingCostMode === 'function');
    await seed(page, 'missing');
    await switchView(page, 'seisan');
    await shot(page, 'settlement-missing', size, '#seisan-view-area', positions, dpr);
  }
  await context.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  report.browser = await browser.version();
  for (const size of sizes) {
    console.log(`capture saas ${size.name}`);
    await captureScenario(browser, size);
  }
  await browser.close();
  const reportName = widthFilter ? `audit-report-${widthFilter}.json` : 'audit-report.json';
  fs.writeFileSync(path.join(OUT, reportName), JSON.stringify(report, null, 2));
  console.log(`saved ${report.screenshots.length} screenshots to ${OUT}`);
})();
