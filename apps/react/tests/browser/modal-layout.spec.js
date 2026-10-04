import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { navigateToProjectSection } from './project-navigation.js';
import { editFee } from './vehicle-cost-fixture.js';

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
  test.slow();
  const errors = [];
  const evidence = process.env.MIGRATION_EVIDENCE_DIR || join(tmpdir(), 'circle-react-migration-evidence');
  page.on('pageerror', error => errors.push(error.message));

  await navigateToProjectSection(page, '車割');
  await page.getByRole('button', { name: '車を追加', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: '車を追加' });
  await expectViewportFrame(page, dialog);
  await dialog.getByRole('button', { name: 'キャンセル' }).click();

  await navigateToProjectSection(page, '班割');
  await page.getByRole('button', { name: '班を追加', exact: true }).click();
  dialog = page.getByRole('dialog', { name: '班を追加' });
  await expectViewportFrame(page, dialog);
  await dialog.getByRole('button', { name: 'キャンセル' }).click();

  await navigateToProjectSection(page, '精算');
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

  await page.locator('.settlement-car').first().getByRole('button',{name:/費用を入力$/}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.screenshot({path:join(evidence,`vehicle-expense-${testInfo.project.name}.png`),fullPage:true});
  await page.getByRole('button',{name:'費用を追加',exact:true}).click();
  await page.getByRole('textbox',{name:'費用名',exact:true}).fill('保持する費用');
  await page.getByRole('link',{name:'費目一覧に戻る',exact:true}).click();
  await editFee(page,'移動条件');
  await page.getByRole('textbox',{name:'走行距離（km）',exact:true}).fill('42');
  await page.getByRole('button',{name:'ルートから距離を計算',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading',{level:1,name:'移動距離を計算'})).toBeVisible();
  await page.screenshot({path:join(evidence,`route-planner-${testInfo.project.name}.png`),fullPage:true});
  await page.getByRole('link',{name:'移動条件に戻る',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'走行距離（km）',exact:true})).toHaveValue('42');
  await page.getByRole('link',{name:'費目一覧に戻る',exact:true}).click();
  await editFee(page,'保持する費用');
  await expect(page.getByRole('textbox',{name:'費用名',exact:true})).toHaveValue('保持する費用');
  await page.getByRole('button',{name:'キャンセル',exact:true}).click();

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
