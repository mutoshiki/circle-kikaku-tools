import { test, expect } from '@playwright/test';
import { seedVehicleCostRoom, vehicleFixture } from './vehicle-cost-fixture.js';
import { join } from 'node:path';
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
async function open(page, testInfo, room = vehicleFixture, suffix = 'rules') {
  const roomId = `G-RESP-${testInfo.project.name}-${testInfo.testId}-${testInfo.retry}`;
  await seedVehicleCostRoom(page, { roomId, room }); await page.goto(`/?room=${roomId}&handoffToken=shared&section=settlement&task=${suffix}`);
  await page.getByRole('main').getByRole('heading', { level: 1 }).waitFor(); return roomId;
}
for (const theme of ['light', 'dark']) test(`single form follows Carbon lg with document scroll, long input and reachable actions: ${theme}`, async ({ page }, testInfo) => {
  const room = structuredClone(vehicleFixture); room.roomName = '長い確認用企画名'.repeat(12); await open(page, testInfo, room);
  if (theme === 'dark') { await page.getByRole('button', { name: 'ユーティリティメニュー' }).click(); await page.getByRole('menuitem', { name: 'ダークモードに切り替え' }).click(); }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByText('人数だけで精算', { exact: true }).click();
  await page.getByRole('textbox', { name: '運転手の人数', exact: true }).fill('99');
  await page.getByRole('textbox', { name: '同乗者の人数', exact: true }).fill('99');
  await page.getByRole('textbox', { name: '運転手1の名前', exact: true }).fill('長いドライバー名'.repeat(6));
  const reward = page.getByRole('textbox', { name: '1台あたりの協力代（円）', exact: true }); await reward.fill('123,456,789');
  const form = page.getByRole('form', { name: '精算ルール', exact: true });
  for (const [width, height] of [[390,844],[390,500],[1055,900],[1056,900],[1280,900]]) {
    await page.setViewportSize({ width, height }); await expect(form).toHaveCount(1); await expect(reward).toHaveValue('123,456,789');
    await expect(page.getByRole('textbox', { name: /^運転手\d+の名前$/ })).toHaveCount(99);
    expect(await overflow(page)).toBeLessThanOrEqual(1);
    const inputs = await page.getByRole('heading', { name: '精算対象', exact: true }).boundingBox(), preview = await page.getByRole('heading', { name: '計算への影響', exact: true }).boundingBox();
    if (width >= 1056) expect(preview.x).toBeGreaterThan(inputs.x + inputs.width); else expect(preview.y).toBeGreaterThan(inputs.y);
    const save = page.getByRole('button', { name: '精算ルールを保存', exact: true }); await save.scrollIntoViewIfNeeded();
    const box = await save.boundingBox(); expect(box.height).toBeGreaterThanOrEqual(44); expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
    expect(await save.evaluate(node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(true);
    expect(await form.evaluate(node => getComputedStyle(node).position)).not.toBe('fixed');
  }
  await page.setViewportSize(testInfo.project.use.viewport); await form.scrollIntoViewIfNeeded();
  // WebKit caps raster dimensions at 32767px; stress-page geometry is asserted
  // above and the visible viewport is the review artifact, not the whole 99-car page.
  await page.screenshot({ path: join(testInfo.outputDir, `rules-${theme}.png`) });
});
test('keyboard, IME, error summary and explicit Back have logical focus; history restores raw draft', async ({ page }, testInfo) => {
  await open(page, testInfo); await expect(page.getByRole('heading', { level: 1 })).not.toBeFocused();
  const rounding = page.getByRole('radio', { name: '100円単位', exact: true }); await rounding.focus(); await rounding.press('ArrowUp'); await expect(page.getByRole('radio', { name: '10円単位', exact: true })).toBeChecked();
  const reward = page.getByRole('textbox', { name: '1台あたりの協力代（円）', exact: true });
  await reward.dispatchEvent('compositionstart'); await reward.fill('1500'); await reward.press('Enter'); await expect(page.getByRole('heading', { name: '精算ルール', level: 1, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '精算ルールを保存', exact: true })).toBeDisabled(); await reward.dispatchEvent('compositionend');
  await reward.fill('-1'); await page.getByRole('button', { name: '精算ルールを保存', exact: true }).click(); await expect(reward).toBeFocused();
  const described = await reward.getAttribute('aria-errormessage'); expect(described).toBeTruthy(); await expect(page.locator(`[id="${described}"]`)).toContainText('0円以上');
  await page.getByRole('region', { name: '入力エラー' }).getByRole('link').click(); await expect(reward).toBeFocused();
  await reward.fill('1500'); await page.getByRole('link', { name: '精算に戻る', exact: true }).click(); await expect(page.getByRole('link', { name: '精算ルール', exact: true })).toBeFocused();
  await page.goBack(); await expect(page.getByRole('heading', { level: 1, name: '精算ルール', exact: true })).toBeFocused(); await expect(reward).toHaveValue('1500');
  await page.reload(); await expect(reward).toHaveValue('1500'); await page.goForward(); await expect(page.getByRole('heading', { level: 1, name: '精算', exact: true })).toBeFocused();
});
test('readiness links select the exact fee and browser Back restores the rules draft and current navigation', async ({ page }, testInfo) => {
  const room = structuredClone(vehicleFixture); room.settlement.cars['仮参加者A'].dist = ''; await open(page, testInfo, room);
  const reward = page.getByRole('textbox', { name: '1台あたりの協力代（円）', exact: true }); await reward.fill('1500');
  await page.getByRole('region', { name: '精算に必要な入力' }).getByRole('link', { name: /仮参加者A車: 移動距離/ }).click();
  await expect(page).toHaveURL(/section=vehicle-costs/); await expect(page).toHaveURL(/expense=movement/);
  await expect(page.getByRole('textbox', { name: '走行距離（km）', exact: true })).toBeVisible();
  await page.goBack(); await expect(page.getByRole('heading', { level: 1, name: '精算ルール', exact: true })).toBeFocused(); await expect(reward).toHaveValue('1500');
  const trigger = page.getByRole('button', { name: '企画メニューを開く' }); if (await trigger.isVisible()) await trigger.click();
  await expect(page.getByRole('navigation', { name: '企画内ナビゲーション' }).getByRole('link', { name: '精算', exact: true })).toHaveAttribute('aria-current', 'page');
});
test('touch mode choice, direct legacy parent and invalid task fallback do not lose the room', async ({ page }, testInfo) => {
  const id = await open(page, testInfo);
  const choice = page.getByText('人数だけで精算', { exact: true }); if (testInfo.project.use.hasTouch) await choice.tap(); else await choice.click();
  await expect(page.getByRole('textbox', { name: '運転手の人数', exact: true })).toBeVisible();
  await page.goto(`/?room=${id}&view=seisan`); await expect(page.getByRole('heading', { level: 1, name: '精算', exact: true })).toBeVisible();
  await page.goto(`/?room=${id}&section=settlement&task=bad`); await expect(page).not.toHaveURL(/task=/); await expect(page).toHaveURL(new RegExp(`room=${id}`));
  await expect(page.getByText('指定された精算画面が見つかりません。精算ルールはここから開けます。')).toBeVisible(); expect(await overflow(page)).toBeLessThanOrEqual(1);
});

test('new standalone cost targets require rules Save before offering a usable corrective link', async ({ page }, testInfo) => {
  await open(page, testInfo);
  await page.getByText('人数だけで精算', { exact: true }).click();
  await page.getByRole('textbox', { name: '運転手の人数', exact: true }).fill('1');
  await page.getByRole('textbox', { name: '同乗者の人数', exact: true }).fill('2');
  await page.getByRole('textbox', { name: '運転手1の名前', exact: true }).fill('新しい運転手');
  const readiness = page.getByRole('region', { name: '精算に必要な入力' });
  await expect(readiness.getByRole('link', { name: /新しい運転手車/ })).toHaveCount(0);
  await expect(readiness).toContainText('先に精算ルールを保存');
  await page.getByRole('button', { name: '精算ルールを保存', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: '精算', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '精算ルール', exact: true }).click();
  await readiness.getByRole('link', { name: /新しい運転手車: 移動距離/ }).click();
  await expect(page.getByRole('textbox', { name: '走行距離（km）', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/car=name/);
});
