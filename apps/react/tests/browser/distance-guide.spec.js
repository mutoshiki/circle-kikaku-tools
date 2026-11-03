import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/legacy-v4.json', import.meta.url)));

test('distance guide opens Google Maps without APIs and preserves manual gas calculation', async ({ page }, testInfo) => {
  const roomId = `DISTANCE-GUIDE-${testInfo.project.name}`;
  const mapsApiRequests = [];
  page.on('request', request => { if (/maps\.googleapis\.com|places\.googleapis\.com|routes\.googleapis\.com/.test(request.url())) mapsApiRequests.push(request.url()); });
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: `sanpo-react:v1:${roomId}:room`, value: structuredClone(fixture),
  });
  await page.goto(`/?room=${roomId}&view=seisan`);
  await page.getByRole('button', { name: '仮参加者A車の費用を編集' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'ガソリン代の計算条件を編集' }).click();
  await dialog.getByLabel('移動距離（km）').fill('186');
  await dialog.getByLabel('燃費（km/L）').fill('18');
  await dialog.getByLabel('ガソリン単価（円/L）').fill('158');
  await dialog.getByRole('button', { name: 'Googleマップで距離を確認' }).click();

  await expect(dialog.getByRole('heading', { name: 'Googleマップで移動距離を確認' })).toBeVisible();
  await expect(dialog.locator('.distance-guide__step')).toHaveCount(4);
  await expect(dialog.locator('.distance-guide__step img')).toHaveCount(4);
  await expect.poll(() => dialog.locator('.distance-guide__step img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
  await expect(dialog.getByRole('checkbox', { name: '次回からこの説明を表示しない' })).not.toBeChecked();
  const mapsLink = dialog.getByRole('link', { name: 'Googleマップを開く' });
  await expect(mapsLink).toHaveAttribute('href', 'https://www.google.com/maps');
  await expect(mapsLink).toHaveAttribute('target', '_blank');
  await dialog.locator('label[for="distance-guide-skip-next-time"]').click();
  await expect(dialog.getByRole('checkbox', { name: '次回からこの説明を表示しない' })).toBeChecked();
  const popupPromise = page.waitForEvent('popup');
  await mapsLink.click();
  const popup = await popupPromise;
  expect(popup.url()).toBe('https://www.google.com/maps');
  await popup.close();
  await page.reload();
  const restored = page.getByRole('dialog', { name: '仮参加者A車：ガソリン代を設定' });
  await expect(restored).toBeVisible();
  await expect(restored.getByLabel('移動距離（km）')).toHaveValue('186');
  await expect(restored.getByLabel('燃費（km/L）')).toHaveValue('18');
  await expect(restored.getByLabel('ガソリン単価（円/L）')).toHaveValue('158');
  await expect(restored.getByRole('link', { name: 'Googleマップで距離を確認' })).toBeVisible();
  await restored.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '仮参加者A車：費用一覧' })).toBeVisible();
  await page.getByRole('dialog').locator('.cds--modal-footer').getByRole('button', { name: '閉じる', exact: true }).click();
  const carRow = page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) });
  await carRow.getByRole('button', { name: /支払い内訳/ }).click();
  await expect(carRow.getByText('¥1,633', { exact: true })).toBeVisible();
  expect(mapsApiRequests).toEqual([]);

  await page.reload();
  await page.getByRole('tab', { name: '精算', exact: true }).click();
  await page.getByRole('button', { name: '仮参加者A車の費用を編集' }).click();
  const saved = page.getByRole('dialog');
  await saved.getByRole('button', { name: 'ガソリン代の計算条件を編集' }).click();
  await expect(saved.getByRole('link', { name: 'Googleマップで距離を確認' })).toBeVisible();
  await saved.getByRole('button', { name: '操作方法' }).click();
  await expect(saved.getByRole('heading', { name: 'Googleマップで移動距離を確認' })).toBeVisible();
});
