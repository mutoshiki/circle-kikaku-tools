import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/legacy-v4.json', import.meta.url)));

async function expectViewportFrame(page, dialog) {
  await expect(dialog).toBeVisible();
  const frame = await dialog.evaluate(node => {
    const rect = node.getBoundingClientRect();
    return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: innerWidth, height: innerHeight };
  });
  if (frame.width <= 672) {
    expect(frame.x, JSON.stringify(frame)).toBe(0);
    expect(frame.right, JSON.stringify(frame)).toBe(frame.width);
    expect(Math.abs(frame.bottom - frame.height), JSON.stringify(frame)).toBeLessThan(1);
    expect(frame.y, JSON.stringify(frame)).toBeGreaterThanOrEqual(0);
    return;
  }
  expect(frame.y, JSON.stringify(frame)).toBeGreaterThanOrEqual(8);
  expect(frame.x, JSON.stringify(frame)).toBeGreaterThanOrEqual(8);
  expect(frame.right, JSON.stringify(frame)).toBeLessThanOrEqual(frame.width - 8);
  expect(frame.bottom, JSON.stringify(frame)).toBeLessThanOrEqual(frame.height - 8);
}

test.beforeEach(async ({ page }, testInfo) => {
  const roomId = `MODAL-${testInfo.project.name}-${testInfo.retry}`;
  await page.addInitScript(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
    window.__REACT_ROUTE_ADAPTER__ = {
      async search(query) { return [{ query }]; },
      async resolve(prediction) { return { placeId: prediction.query, name: prediction.query, address: '', latitude: 35, longitude: 139 }; },
      async calculate(state) { return { ...state, routes: [], selectedRouteIndex: 0, calculatedAt: Date.now() }; },
    };
  }, { key: `sanpo-react:v1:${roomId}:room`, value: fixture });
  await page.goto(`/?room=${roomId}`);
});

test('primary dialogs retain viewport margins and usable actions', async ({ page }, testInfo) => {
  const errors = [];
  const evidence = process.env.MIGRATION_EVIDENCE_DIR || join(tmpdir(), 'circle-react-migration-evidence');
  page.on('pageerror', error => errors.push(error.message));

  await page.getByRole('tab', { name: '車割', exact: true }).click();
  await page.getByRole('button', { name: '車を追加', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: '車を追加' });
  await expectViewportFrame(page, dialog);
  await dialog.getByRole('button', { name: 'キャンセル' }).click();

  await page.getByRole('tab', { name: '班割', exact: true }).click();
  await page.getByRole('button', { name: '班を追加', exact: true }).click();
  dialog = page.getByRole('dialog', { name: '班を追加' });
  await expectViewportFrame(page, dialog);
  await dialog.getByRole('button', { name: 'キャンセル' }).click();

  await page.getByRole('tab', { name: '精算', exact: true }).click();
  await page.getByRole('button', { name: '精算設定を編集' }).click();
  dialog = page.getByRole('dialog', { name: '精算設定を編集' });
  await expectViewportFrame(page, dialog);
  await expect(dialog.locator('.cds--progress-label')).toHaveText(['精算方法', '車出し協力代', '集金ルール']);
  if (testInfo.project.name.includes('mobile')) await expect(dialog.locator('.cds--progress')).toHaveClass(/cds--progress--vertical/);
  else await expect(dialog.locator('.cds--progress')).not.toHaveClass(/cds--progress--vertical/);
  await expect(dialog.locator('.cds--modal-footer button')).toHaveText(['キャンセル', '戻る', '次へ']);
  await expect(dialog.getByRole('radio', { name: '参加者を登録して精算' })).toBeChecked();
  await expect(dialog.getByRole('radio', { name: '100円単位' })).toBeChecked();
  await page.screenshot({ path: join(evidence, `settlement-wizard-${testInfo.project.name}.png`) });
  await dialog.getByRole('button', { name: 'キャンセル' }).click();

  await page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) }).getByRole('button', { name: '費用を編集' }).click();
  dialog = page.getByRole('dialog', { name: '仮参加者A車' });
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expectViewportFrame(page, dialog);
  await expect(dialog.getByRole('heading', { name: '費用を編集' })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: '費用一覧' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: '計算条件を変更' })).toHaveCount(0);
  if (testInfo.project.name.includes('mobile')) {
    const expenseFrame = await dialog.evaluate(node => ({ ...node.getBoundingClientRect().toJSON(), viewportHeight: innerHeight }));
    expect(Math.abs(expenseFrame.bottom - expenseFrame.viewportHeight)).toBeLessThan(1);
    expect(expenseFrame.height).toBeLessThan(expenseFrame.viewportHeight * .85);
  }
  await expect(dialog.getByRole('button', { name: '費用を追加' })).toBeVisible();
  if (testInfo.project.name.includes('mobile')) {
    const compactRow = await dialog.locator('.settlement-cost-list-item .settlement-cost-summary').first().evaluate(row => {
      const name = row.querySelector(':scope > strong').getBoundingClientRect();
      const amount = row.querySelector('.settlement-cost-summary__amount').getBoundingClientRect();
      return Math.abs(name.top - amount.top) < 64 && amount.left > name.left;
    });
    expect(compactRow).toBe(true);
  }
  await page.screenshot({ path: join(evidence, `vehicle-expense-${testInfo.project.name}.png`) });
  await dialog.getByRole('button', { name: '費用を追加' }).click();
  await dialog.getByLabel('名目').last().fill('保持する費用');
  await dialog.locator('.settlement-cost-list-item').filter({ hasText: 'ガソリン代' }).click();

  const movement = page.getByRole('dialog', { name: '仮参加者A車' });
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(movement.getByRole('heading', { name: 'ガソリン代を設定' })).toBeVisible();
  await expectViewportFrame(page, movement);
  await expect(movement.getByRole('heading', { name: '移動料金の計算条件' })).toBeVisible();
  await movement.getByLabel('移動距離（km）').fill('42');
  await movement.getByRole('button', { name: 'ルートから距離を計算' }).click();

  const route = page.getByRole('dialog', { name: '仮参加者A車' });
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expectViewportFrame(page, route);
  await expect(route.getByRole('heading', { name: '移動距離を計算' })).toBeVisible();
  await page.screenshot({ path: join(evidence, `route-planner-${testInfo.project.name}.png`) });
  await route.getByRole('button', { name: '戻る' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expectViewportFrame(page, movement);
  await expect(movement.getByLabel('移動距離（km）')).toHaveValue('42');
  await movement.getByRole('button', { name: 'ガソリン代を適用' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  dialog = page.getByRole('dialog', { name: '仮参加者A車' });
  await expectViewportFrame(page, dialog);
  await expect(dialog.locator('.settlement-cost-list-item').filter({ hasText: '保持する費用' })).toBeVisible();
  await dialog.getByRole('button', { name: 'キャンセル' }).click();

  await page.getByRole('button', { name: 'ユーティリティメニュー' }).click();
  const appMenu = page.getByRole('menu', { name: 'ユーティリティメニュー' });
  await expect(appMenu.getByRole('menuitem')).toHaveText(['使い方', 'サンプルデータ', 'ダークモードに切り替え', 'バグを報告する']);
  await appMenu.getByRole('menuitem', { name: 'ダークモードに切り替え' }).click();
  await expect(page.locator('.application')).toHaveClass(/cds--g100/);
  await page.getByRole('button', { name: '精算設定を編集' }).click();
  dialog = page.getByRole('dialog', { name: '精算設定を編集' });
  await expectViewportFrame(page, dialog);
  expect(await dialog.evaluate(node => getComputedStyle(node).backgroundColor)).not.toBe('rgb(255, 255, 255)');
  await page.screenshot({ path: join(evidence, `settlement-wizard-dark-${testInfo.project.name}.png`) });
  await dialog.getByRole('button', { name: 'キャンセル' }).click();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
