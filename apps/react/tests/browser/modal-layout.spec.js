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
  await page.getByRole('link', { name: '精算ルール', exact: true }).click();
  const rules = page.getByRole('form', { name: '精算ルール', exact: true });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(rules).toHaveCount(1);
  await expect(rules.getByRole('radio', { name: '登録した参加者で精算' })).toBeChecked();
  await expect(rules.getByRole('radio', { name: '100円単位' })).toBeChecked();
  await expect(rules.getByRole('heading', { level: 2, name: '計算への影響' })).toBeVisible();
  const rulesSave = rules.getByRole('button', { name: '精算ルールを保存', exact: true });
  await rulesSave.scrollIntoViewIfNeeded();
  expect((await rulesSave.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: join(evidence, `settlement-rules-${testInfo.project.name}.png`), fullPage: true });
  await rules.getByRole('button', { name: 'キャンセル' }).click();
  await expect(page.getByRole('link', { name: '精算ルール', exact: true })).toBeFocused();

  await page.locator('.settlement-car').first().getByRole('button',{name:/費用を入力$/}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.screenshot({path:join(evidence,`vehicle-expense-${testInfo.project.name}.png`),fullPage:true});
  await page.getByRole('button',{name:'費用を追加',exact:true}).click();
  await page.getByRole('textbox',{name:'費用名',exact:true}).fill('保持する費用');
  await page.getByRole('link',{name:'費目一覧に戻る',exact:true}).click();
  await expect(page.getByRole('link',{name:'移動条件を編集',exact:true})).toBeVisible();
  await editFee(page,'移動条件');
  await page.getByRole('textbox',{name:'走行距離（km）',exact:true}).fill('42');
  await page.getByRole('button',{name:'ルートから距離を計算',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading',{level:1,name:'移動距離を計算'})).toBeVisible();
  await page.screenshot({path:join(evidence,`route-planner-${testInfo.project.name}.png`),fullPage:true});
  await page.getByRole('link',{name:'移動条件に戻る',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'走行距離（km）',exact:true})).toHaveValue('42');
  await page.getByRole('link',{name:'費目一覧に戻る',exact:true}).click();
  await expect(page.getByRole('link',{name:'保持する費用を編集',exact:true})).toBeVisible();
  await editFee(page,'保持する費用');
  await expect(page.getByRole('textbox',{name:'費用名',exact:true})).toHaveValue('保持する費用');
  await page.getByRole('button',{name:'キャンセル',exact:true}).click();

  await page.getByRole('button', { name: 'ユーティリティメニュー' }).click();
  const appMenu = page.getByRole('menu', { name: 'ユーティリティメニュー' });
  await expect(appMenu.getByRole('menuitem')).toHaveText(['使い方', 'サンプルデータ', 'ダークモードに切り替え', 'バグを報告する']);
  await appMenu.getByRole('menuitem', { name: 'ダークモードに切り替え' }).click();
  await expect(page.locator('.application')).toHaveClass(/cds--g100/);
  await page.getByRole('link', { name: '精算ルール', exact: true }).click();
  await expect(page.getByRole('form', { name: '精算ルール', exact: true })).toBeVisible();
  expect(await page.getByRole('textbox', { name: '1台あたりの協力代（円）', exact: true }).evaluate(node => getComputedStyle(node).backgroundColor)).not.toBe('rgb(255, 255, 255)');
  await page.screenshot({ path: join(evidence, `settlement-rules-dark-${testInfo.project.name}.png`), fullPage: true });
  await page.getByRole('button', { name: 'キャンセル' }).click();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
