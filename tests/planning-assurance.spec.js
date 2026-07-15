const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..');
const readAsset = relativePath => fs.readFileSync(path.join(ROOT, relativePath));

async function prepare(page, query = '') {
  if (!query.includes('qa=coach')) {
    await page.addInitScript(() => localStorage.setItem('sanpo_coach_seen_v1', '1'));
  }
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url.endsWith('/firebase-config.js')) {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.SANPO_FIREBASE_CONFIG = {};' });
    }
    if (url.includes('bootstrap@5.3.0/dist/css/bootstrap.min.css')) {
      return route.fulfill({ status: 200, contentType: 'text/css', body: readAsset('node_modules/bootstrap/dist/css/bootstrap.min.css') });
    }
    if (url.includes('bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js')) {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: readAsset('node_modules/bootstrap/dist/js/bootstrap.bundle.min.js') });
    }
    if (url.includes('font-awesome/6.4.0/css/all.min.css')) {
      return route.fulfill({ status: 200, contentType: 'text/css', body: readAsset('node_modules/@fortawesome/fontawesome-free/css/all.min.css') });
    }
    if (url.includes('font-awesome/6.4.0/webfonts/')) {
      const filename = path.basename(new URL(url).pathname);
      return route.fulfill({ status: 200, contentType: 'font/woff2', body: readAsset(`node_modules/@fortawesome/fontawesome-free/webfonts/${filename}`) });
    }
    if (url.includes('Sortable/1.15.0/Sortable.min.js')) {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: readAsset('node_modules/sortablejs/Sortable.min.js') });
    }
    return route.continue();
  });
  await page.goto(`./index.html?room=assurance-${Date.now()}${query}`);
  await page.waitForFunction(() => typeof window.executeDebugMode === 'function');
}

async function seed(page) {
  await page.evaluate(() => window.executeDebugMode());
  await page.waitForFunction(() => document.querySelectorAll('.car-box').length > 0);
  await page.waitForTimeout(180);
  await page.evaluate(() => window.switchView('list'));
  await page.waitForFunction(() => document.body.classList.contains('view-mode-list'));
}

test('generic person flag syncs across plans and can be undone', async ({ page }) => {
  await prepare(page);
  await seed(page);

  const visibleMember = page.locator('.member-card:visible').first();
  const name = await visibleMember.getAttribute('data-name');
  await visibleMember.locator('.member-menu-btn').click();
  await page.getByRole('button', { name: 'しるし', exact: true }).click();
  await page.getByRole('button', { name: '赤', exact: true }).click();
  await expect(page.locator(`.member-card[data-name="${name}"]:visible .person-flag[data-flag="red"]`).first()).toBeVisible();

  await page.getByRole('tab', { name: '班割' }).click();
  await expect(page.locator(`.member-card[data-name="${name}"]:visible .person-flag[data-flag="red"]`).first()).toBeVisible();

  await page.getByRole('button', { name: '元に戻す' }).click();
  await expect(page.locator('.person-flag[data-flag="red"]')).toHaveCount(0);
});

test('coach mark, planning check, skeleton and responsive layout remain usable', async ({ page }) => {
  await prepare(page, '&qa=coach');
  await seed(page);

  await expect(page.getByRole('dialog', { name: '参加者を登録' })).toBeVisible();
  await page.getByRole('button', { name: '次へ' }).click();
  await expect(page.getByRole('dialog', { name: '車割と班割を切り替え' })).toBeVisible();
  await page.getByRole('button', { name: '次へ' }).click();
  await expect(page.getByRole('dialog', { name: 'カードから細かく設定' })).toBeVisible();
  await page.getByRole('button', { name: '完了' }).click();

  await page.getByRole('button', { name: 'その他' }).click();
  await page.locator('#planningCheckBtn').click();
  await expect(page.locator('#planningCheckModal')).toBeVisible();
  await expect(page.locator('#planningCheckSummary')).toContainText(/要確認|確認完了/);
  await page.getByRole('button', { name: '確認しました' }).click();
  await expect(page.locator('#appLoadingSkeleton')).toBeHidden();

  for (const width of [360, 390, 430, 768]) {
    await page.setViewportSize({ width, height: 844 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${width}px viewport must not overflow`).toBeLessThanOrEqual(1);
    await expect(page.locator('.allocation-mode-toggle')).toBeVisible();
    await expect(page.locator('.car-box').first()).toBeVisible();
  }
});

test('new rooms expose intentional empty states', async ({ page }) => {
  await prepare(page);
  await page.locator('#tab-list').click();
  await expect(page.getByText('参加者がまだいません')).toBeVisible();
  await page.locator('#tab-sheet').click();
  await expect(page.getByText('共有できるデータがありません')).toBeVisible();
  await page.locator('#tab-seisan').click();
  await expect(page.getByText('精算するデータがありません')).toBeVisible();
});
