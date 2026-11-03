import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/legacy-v4.json', import.meta.url)));
const token = `h_${'R'.repeat(48)}`;

test.beforeEach(async ({ page }, testInfo) => {
  const roomId = `PHASE6-${testInfo.project.name}-${testInfo.retry}`;
  await page.addInitScript(({ key, value }) => {
    if (!sessionStorage.getItem(`seed:${key}`)) {
      localStorage.setItem(key, JSON.stringify(value));
      sessionStorage.setItem(`seed:${key}`, '1');
    }
    window.__REACT_EXTERNAL_ADAPTERS__ = {
      async handoff() { return { ok: true, filename: '参加者.csv', participants: [{ studentId: 'S001', name: '仮参加者A' }] }; },
      async bugReport(payload) { window.__phase6BugReport = payload; return { ok: true }; },
    };
  }, { key: `sanpo-react:v1:${roomId}:room`, value: fixture });
  await page.goto(`/?room=${roomId}&view=sheet&allocation=car&handoff=${token}`);
  await expect(page).toHaveURL(new RegExp(`\\?room=${roomId}$`));
});

test('guidance, CSV, utility report, notifications and URL security', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.getByRole('tab', { name: '参加者', exact: true }).click();
  let saved = await page.evaluate(roomId => JSON.parse(localStorage.getItem(`sanpo-react:v1:${roomId}:room`)), new URL(page.url()).searchParams.get('room'));
  expect(saved.meta.applicationSync.title).toBe(fixture.meta.applicationSync.title);

  await page.getByRole('button', { name: '発表文を作成' }).click();
  const guidance = page.getByRole('dialog', { name: '参加者発表文を作成' });
  await guidance.getByLabel('集合時間').fill('08:30');
  await expect(guidance.getByLabel('発表文（確認してからコピー）')).toHaveValue(/参加者は.*人です/);
  await guidance.getByLabel('閉じる').click();

  await page.getByRole('button', { name: '学務書類用CSVを作成' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('dialog', { name: '学務書類用CSV' }).getByRole('button', { name: 'CSVを作成' }).click();
  expect((await download).suggestedFilename()).toBe('参加者.csv');

  await page.getByRole('button', { name: 'その他の操作' }).click();
  await page.getByRole('menuitem', { name: '不具合を報告' }).click();
  await page.getByLabel('起きたこと').fill('fixture only');
  await page.getByRole('dialog', { name: '不具合を報告' }).getByRole('button', { name: '報告を送信' }).click();
  expect(await page.evaluate(() => window.__phase6BugReport?.message)).toBe('fixture only');
  expect(await page.evaluate(() => location.href.includes('handoff'))).toBe(false);
  expect(JSON.stringify(saved)).not.toContain(token);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('manual distance entry survives Google Maps handoff and saves through settlement', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.getByRole('tab', { name: '精算', exact: true }).click();
  await page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) }).getByRole('button', { name: /の費用を(?:入力|編集)$/ }).click();
  let car = page.getByRole('dialog', { name: /^仮参加者A車：/ });
  await car.getByRole('button', { name: '新しい費用を追加', exact: true }).click();
  await car.getByLabel('費用名').fill('一時費用');
  await car.getByLabel('金額（円）').fill('100');
  await car.getByRole('button', { name: '保存', exact: true }).click();
  await expect(car.getByRole('heading', { name: '費用一覧' })).toBeVisible();
  const addedExpense = car.locator('.settlement-cost-list-item').filter({ hasText: '一時費用' });
  await addedExpense.getByRole('button', { name: '一時費用を編集' }).click();
  await car.getByRole('button', { name: 'この費用を削除', exact: true }).click();
  await expect(car.getByRole('heading', { name: '費用一覧' })).toBeVisible();
  await expect(car.locator('.settlement-cost-list-item').filter({ hasText: '一時費用' })).toHaveCount(0);
  await car.getByRole('button', { name: 'ガソリン代の計算条件を編集' }).click();
  await car.getByLabel('移動距離（km）').fill('186');
  await car.getByRole('button', { name: 'Googleマップで距離を確認' }).click();
  await expect(car.locator('.distance-guide__step')).toHaveCount(4);
  await expect(car.getByRole('link', { name: 'Googleマップを開く' })).toHaveAttribute('href', 'https://www.google.com/maps');
  await car.getByRole('button', { name: '戻る', exact: true }).click();
  await expect(car.getByLabel('移動距離（km）')).toHaveValue('186');
  await car.getByRole('button', { name: '保存', exact: true }).click();
  await expect(car.getByRole('heading', { name: '費用一覧' })).toBeVisible();
  await car.locator('.cds--modal-footer').getByRole('button', { name: '閉じる', exact: true }).click();
  const state = await page.evaluate(roomId => JSON.parse(localStorage.getItem(`sanpo-react:v1:${roomId}:room`)), new URL(page.url()).searchParams.get('room'));
  expect(JSON.stringify(state)).not.toContain('fixture-route');
  expect(JSON.stringify(state)).not.toContain(token);
  await page.reload(); await page.getByRole('tab', { name: '精算', exact: true }).click(); await page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) }).getByRole('button', { name: /の費用を(?:入力|編集)$/ }).click();
  const reopened = page.getByRole('dialog', { name: /^仮参加者A車：/ });
  await reopened.getByRole('button', { name: 'ガソリン代の計算条件を編集' }).click();
  await expect(reopened.getByLabel('移動距離（km）')).toHaveValue('186');
  await reopened.locator('.cds--modal-close').click();
  await page.getByRole('button', { name: 'その他の操作' }).click(); await page.getByRole('menuitem', { name: 'ダークモードに切り替え' }).click();
  await expect(page.locator('.application')).toHaveClass(/cds--g100/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
