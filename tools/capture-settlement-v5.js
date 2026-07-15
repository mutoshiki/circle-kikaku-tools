const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('@playwright/test');

const ROOT = process.cwd();
const asset = relativePath => fs.readFileSync(path.join(ROOT, relativePath));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForServer() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const response = await fetch('http://127.0.0.1:4173/index.html');
      if (response.ok) return;
    } catch {}
    await wait(100);
  }
  throw new Error('server did not start');
}

async function routeOffline(page) {
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url === 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css') {
      return route.fulfill({ status: 200, contentType: 'text/css', body: asset('node_modules/bootstrap/dist/css/bootstrap.min.css') });
    }
    if (url === 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js') {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: asset('node_modules/bootstrap/dist/js/bootstrap.bundle.min.js') });
    }
    if (url === 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css') {
      return route.fulfill({ status: 200, contentType: 'text/css', body: asset('node_modules/@fortawesome/fontawesome-free/css/all.min.css') });
    }
    if (url.startsWith('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/')) {
      const filename = path.basename(new URL(url).pathname);
      return route.fulfill({ status: 200, contentType: 'font/woff2', body: asset(`node_modules/@fortawesome/fontawesome-free/webfonts/${filename}`) });
    }
    if (url === 'https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.0/Sortable.min.js') {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: asset('node_modules/sortablejs/Sortable.min.js') });
    }
    if (url.endsWith('/firebase-config.js')) {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.SANPO_FIREBASE_CONFIG = {};' });
    }
    return route.continue();
  });
}

async function setup(page, room) {
  await routeOffline(page);
  await page.goto(`http://127.0.0.1:4173/index.html?room=${room}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.executeDebugMode === 'function' && typeof window.switchView === 'function');
  await page.evaluate(() => {
    localStorage.removeItem('syawari_settlement_car_layout');
    window.executeDebugMode();
  });
  await page.waitForTimeout(350);
  await page.locator('#tab-seisan').click();
  await page.waitForTimeout(150);
  await page.addStyleTag({ content: '#appStatusToast { display: none !important; }' });
  await page.evaluate(() => document.querySelector('#appStatusToast')?.classList.remove('visible'));
}

(async () => {
  const server = spawn(process.execPath, ['tests/serve-static.js'], { cwd: ROOT, stdio: 'ignore' });
  try {
    await waitForServer();
    const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
    try {
      for (const width of [320, 360, 390, 430]) {
        const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
        await setup(page, `CAPTURE-V5-${width}`);
        await page.locator('.seisan-car-panel').screenshot({ path: `/mnt/data/circle-settlement-compact-${width}-v5.png` });
        if (width === 390) {
          await page.locator('#seisanCarLayoutToggle').click();
          await page.waitForTimeout(100);
          await page.locator('.seisan-car-panel').screenshot({ path: '/mnt/data/circle-settlement-list-390-v5.png' });
        }
        await page.close();
      }
    } finally {
      await browser.close();
    }
  } finally {
    server.kill('SIGTERM');
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
