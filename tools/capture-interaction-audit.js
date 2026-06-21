const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(ROOT, process.argv[2] || 'screenshots/final-interactions');
const BROWSER = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/usr/bin/chromium';
const BASE = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:4173/index.html';
const ORIGIN = new URL(BASE).origin;
const SIZES = [{ width: 390, height: 844, name: 'mobile-390' }, { width: 1280, height: 720, name: 'desktop-1280' }];
const report = { generatedAt: new Date().toISOString(), screenshots: [], console: [], requestFailures: [], states: [] };
fs.mkdirSync(OUT, { recursive: true });
const local = rel => fs.readFileSync(path.join(ROOT, rel));

async function routes(page) {
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url === 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css') return route.fulfill({ status: 200, contentType: 'text/css', body: local('node_modules/bootstrap/dist/css/bootstrap.min.css') });
    if (url === 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js') return route.fulfill({ status: 200, contentType: 'application/javascript', body: local('node_modules/bootstrap/dist/js/bootstrap.bundle.min.js') });
    if (url === 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css') return route.fulfill({ status: 200, contentType: 'text/css', body: local('node_modules/@fortawesome/fontawesome-free/css/all.min.css') });
    if (url.startsWith('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/')) {
      const name = path.basename(new URL(url).pathname);
      return route.fulfill({ status: 200, contentType: 'font/woff2', body: local(`node_modules/@fortawesome/fontawesome-free/webfonts/${name}`) });
    }
    if (url === 'https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.0/Sortable.min.js') return route.fulfill({ status: 200, contentType: 'application/javascript', body: local('node_modules/sortablejs/Sortable.min.js') });
    if (url.endsWith('/firebase-config.js')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.SANPO_FIREBASE_CONFIG = {};' });
    if (url.startsWith(`${ORIGIN}/`)) return route.continue();
    return route.abort('blockedbyclient');
  });
}
async function boot(page, room) {
  await routes(page);
  await page.addInitScript(() => { localStorage.clear(); Date.now = () => 1767225600000; });
  await page.goto(`${BASE}?room=${room}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.executeDebugMode === 'function' && typeof window.switchView === 'function');
  await page.evaluate(() => window.executeDebugMode());
  await page.waitForTimeout(450);
  await page.evaluate(() => window.switchView('list'));
  await page.waitForTimeout(120);
}
async function shot(page, size, state) {
  const filename = `${state}-${size.name}.png`;
  await page.screenshot({ path: path.join(OUT, filename), animations: 'disabled', caret: 'hide' });
  report.screenshots.push(filename);
  const metrics = await page.evaluate(() => ({
    active: document.activeElement ? `${document.activeElement.tagName}#${document.activeElement.id}.${document.activeElement.className}` : '',
    documentOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    openModal: document.querySelector('.modal.show')?.id || '',
    bodyClasses: document.body.className
  }));
  report.states.push({ size: size.name, state, ...metrics });
}
async function closeModal(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.modal.show').forEach(el => window.bootstrap?.Modal?.getInstance(el)?.hide());
  });
  await page.waitForTimeout(240);
  await page.evaluate(() => {
    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
    document.body.classList.remove('modal-open');
  });
}
async function captureSize(browser, size) {
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1, locale: 'ja-JP', reducedMotion: 'reduce', colorScheme: 'light' });
  const page = await context.newPage();
  page.on('console', msg => { if (msg.type() === 'error') report.console.push({ size: size.name, text: msg.text() }); });
  page.on('pageerror', err => report.console.push({ size: size.name, text: err.message }));
  page.on('requestfailed', req => { if (!req.url().startsWith('data:')) report.requestFailures.push({ size: size.name, url: req.url(), error: req.failure()?.errorText || '' }); });
  await boot(page, `INTERACTION-${size.width}`);

  await page.locator('#batchOpenBtn').hover();
  await shot(page, size, 'hover-primary');

  await page.evaluate(() => document.activeElement?.blur());
  for (let i = 0; i < 5; i += 1) await page.keyboard.press('Tab');
  await shot(page, size, 'focus-header');

  await page.evaluate(() => { document.querySelector('#batchOpenBtn').disabled = true; });
  await shot(page, size, 'disabled-primary');
  await page.evaluate(() => { document.querySelector('#batchOpenBtn').disabled = false; });

  const primary = page.locator('#batchOpenBtn');
  const pbox = await primary.boundingBox();
  await page.mouse.move(pbox.x + pbox.width / 2, pbox.y + pbox.height / 2);
  await page.mouse.down();
  await shot(page, size, 'active-primary');
  await page.mouse.move(1, 1);
  await page.mouse.up();
  await page.waitForTimeout(80);

  await page.locator('#tab-sheet').hover();
  await shot(page, size, 'selected-and-hover-tab');

  await page.locator('.member-menu-btn').first().click();
  await page.locator('.person-pop-menu').waitFor({ state: 'visible' });
  await shot(page, size, 'person-menu');
  await page.keyboard.press('Escape');

  const card = page.locator('.member-card').first();
  const target = page.locator('.car-box').nth(1);
  const cbox = await card.boundingBox();
  const tbox = await target.boundingBox();
  await page.mouse.move(cbox.x + Math.min(40, cbox.width / 2), cbox.y + cbox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(80);
  await page.mouse.move(tbox.x + tbox.width / 2, tbox.y + Math.min(120, tbox.height / 2), { steps: 8 });
  await page.waitForTimeout(80);
  await shot(page, size, 'drag-in-progress');
  await page.mouse.up();
  await page.waitForTimeout(120);

  await page.evaluate(() => {
    document.querySelector('#roomNameInput').value = '飯綱高原 新歓ドライブ・写真撮影・交流会 参加者最終確認版 2026';
    document.querySelectorAll('.car-name-label').forEach((n, i) => n.textContent = `とても長い運転者氏名と車両情報を含む車名 ${i + 1}号車`);
    document.querySelectorAll('.member-name-text').forEach((n, i) => n.textContent = `非常に長い参加者氏名${i + 1}・所属情報`);
  });
  await shot(page, size, 'long-content-list');

  await page.evaluate(() => window.switchView('seisan'));
  await page.waitForTimeout(120);
  await page.evaluate(() => document.querySelectorAll('.seisan-summary-value, .seisan-car-summary-total, .seisan-driver-amount').forEach(n => n.textContent = '¥99,999,999'));
  await shot(page, size, 'long-amount-settlement');

  const modalStates = [
    ['common-edit-modal', () => { window.appPrompt?.('非常に長い参加者名を編集', '山田 太郎・写真部・機械システム工学科'); }],
    ['car-guide-modal', () => window.bootstrap.Modal.getOrCreateInstance(document.querySelector('#guideModal')).show()],
    ['settlement-guide-modal', () => window.bootstrap.Modal.getOrCreateInstance(document.querySelector('#seisanGuideModal')).show()],
    ['history-modal', () => window.showHistory?.()],
    ['debug-modal', () => window.openDebugModal?.()]
  ];
  for (const [state, opener] of modalStates) {
    await closeModal(page);
    await page.evaluate(opener);
    await page.waitForTimeout(120);
    await shot(page, size, state);
  }
  await closeModal(page);
  await context.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  report.browser = await browser.version();
  for (const size of SIZES) await captureSize(browser, size);
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'interaction-audit-report.json'), JSON.stringify(report, null, 2));
  console.log(`saved ${report.screenshots.length} interaction screenshots to ${OUT}`);
})();
