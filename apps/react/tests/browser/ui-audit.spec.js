import {replaceSample,openSampleWorkspace,confirmSampleReplacement} from './sample-workspace.js';
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { navigateToProjectSection } from './project-navigation.js';
import { editFee } from './vehicle-cost-fixture.js';

const root = join(process.cwd(), '..', '..');
const outputRoot = join(tmpdir(), 'circle-react-migration-evidence', 'ui-audit');
function shot(page, viewportName, number, name) {
  const directory = join(outputRoot, viewportName);
  mkdirSync(directory, { recursive: true });
  const path = join(directory, `${String(number).padStart(2, '0')}-${name}.png`);
  return page.mouse.move(1, 1).then(() => page.screenshot({ path }));
}
async function gotoEmpty(page, room) {
  await page.goto(`/?room=${room}`);
  await expect(page).toHaveTitle('山歩会企画ツール');
  await expect(page.getByRole('navigation', { name: '企画内ナビゲーション' })).toHaveCount(1);
}
async function openMenu(page) {
  await page.getByRole('button', { name: 'ユーティリティメニュー' }).click();
  await expect(page.getByRole('menu', { name: 'ユーティリティメニュー' })).toBeVisible();
}
async function closeModal(page) {
  const modal = page.locator('.cds--modal.is-visible');
  if (await modal.count()) {
    await modal.locator('button').first().click({ force: true });
    await expect(modal).toHaveCount(0);
  }
}
async function cancelDialog(page) {
  const dialog = page.getByRole('dialog').last();
  const cancel = dialog.getByRole('button', { name: 'キャンセル', exact: true });
  if (await cancel.count()) await cancel.click({ force: true });
  else await dialog.getByRole('button', { name: '戻る', exact: true }).click({ force: true });
}
async function seedSample(page) {await replaceSample(page);await expect(page.getByRole('main')).toContainText('藤原 拓海');}
async function seedFormSample(page) {await replaceSample(page,'フォーム連携サンプル');await expect(page.getByRole('main')).toContainText('フォーム連携テスト企画');}
async function reopen(page, room) {
  await page.goto(`/?room=${room}`);
  await expect(page.getByRole('navigation', { name: '企画内ナビゲーション' })).toHaveCount(1);
}

test('capture reachable React UI audit states', async ({ page }, testInfo) => {
  test.setTimeout(300000);
  const viewports = testInfo.project.name.includes('mobile')
    ? [['mobile', { width: 390, height: 844 }]]
    : [['desktop', { width: 1440, height: 1000 }]];
  for (const [viewportName, viewport] of viewports) {
    await page.setViewportSize(viewport);
    const room = `UI-AUDIT-${viewportName}`;
    await page.addInitScript(({ room }) => {
      const resetKey = `audit-reset:${room}`;
      if (!sessionStorage.getItem(resetKey)) {
        localStorage.removeItem(`sanpo-react:v1:${room}:room`);
        sessionStorage.setItem(resetKey, '1');
      }
      window.__REACT_ROUTE_ADAPTER__ = {
        async search(query) { return [{ placeId: query, name: query, address: `${query}の住所`, latitude: 35, longitude: 139 }]; },
        async resolve(entry) { return { ...entry, placeId: entry.placeId || entry.query, name: entry.name || entry.query, address: entry.address || '' }; },
        async calculate(state) { return { ...state, routes: [{ id: 'audit-route', label: 'おすすめ', distanceMeters: 12345, durationSeconds: 3600, legs: [{ distanceMeters: 12345, durationSeconds: 3600 }] }], selectedRouteIndex: 0, calculatedAt: Date.now() }; },
      };
    }, { room });

    await gotoEmpty(page, room);
    await navigateToProjectSection(page, '参加者');
    await shot(page, viewportName, 1, 'shell-participants-empty');
    const projectMenu = page.getByRole('button', { name: '企画メニューを開く' });
    if (await projectMenu.isVisible()) await projectMenu.click();
    await expect(page.getByRole('navigation', { name: '企画内ナビゲーション' })).toBeVisible();
    await shot(page, viewportName, 44, 'side-navigation-open');
    if (await page.getByRole('button', { name: '企画メニューを閉じる' }).isVisible()) await page.getByRole('button', { name: '企画メニューを閉じる' }).click();
    await openMenu(page);
    await shot(page, viewportName, 2, 'header-app-menu-open');
    await page.getByRole('menuitem', { name: 'ダークモードに切り替え', exact: true }).click();
    await shot(page, viewportName, 43, 'dark-theme-shell');
    await openMenu(page);
    await page.getByRole('menuitem', { name: 'ライトモードに切り替え', exact: true }).click();
    await openMenu(page);
    await page.getByRole('menuitem', { name: '使い方', exact: true }).click();
    await shot(page, viewportName, 3, 'guide-modal');
    await closeModal(page);
    await page.goto(`/?room=${room}`);
    await openSampleWorkspace(page,'入力漏れサンプル');
    await shot(page,viewportName,4,'sample-data-page');await confirmSampleReplacement(page);
    await shot(page, viewportName, 5, 'sample-missing-toast');
    await closeModal(page);

    await reopen(page, room);
    await navigateToProjectSection(page, '参加者');
    await shot(page, viewportName, 6, 'participants-missing-sample');

    await seedSample(page);
    console.log('AUDIT participants normal seeded');
    await navigateToProjectSection(page, '参加者');
    await shot(page, viewportName, 9, 'participants-default');
    console.log('AUDIT participants default captured');
    if (await page.getByRole('button', { name: '参加者を選び直す', exact: true }).count()) await page.getByRole('button', { name: '参加者を選び直す', exact: true }).click();
    console.log('AUDIT participants selection mode');
    await page.getByRole('searchbox', { name: '名前を検索' }).fill('存在しない名前');
    await expect(page.getByText('“存在しない名前” に一致する参加者はいません', { exact: true })).toBeVisible();
    await shot(page, viewportName, 7, 'participants-search-empty');
    await page.getByRole('button', { name: '検索をクリア' }).click();
    await page.getByRole('button', { name: '絞り込み' }).click();
    await shot(page, viewportName, 8, 'participants-filter-open');
    await page.getByRole('button', { name: '絞り込み' }).click();
    const firstCheckbox = page.getByRole('checkbox').first();
    if (await firstCheckbox.count()) {
      if (await firstCheckbox.isChecked()) await firstCheckbox.uncheck({ force: true });
      else await firstCheckbox.check({ force: true });
    }
    await shot(page, viewportName, 10, 'participants-selection-sticky');
    const firstRowMenu = page.getByRole('button', { name: /の操作$/ }).first();
    await firstRowMenu.click();
    await shot(page, viewportName, 11, 'participants-row-overflow-open');
    await page.getByRole('menuitem', { name: '編集', exact: true }).click();
    await shot(page, viewportName, 12, 'participant-edit-modal');
    await cancelDialog(page);
    await firstRowMenu.click();
    await page.getByRole('menuitem', { name: '削除', exact: true }).click();
    await shot(page, viewportName, 13, 'participant-delete-confirmation');
    await cancelDialog(page);

    await navigateToProjectSection(page, '車割');
    await page.getByRole('link', { name: /車の詳細$/ }).first().click();
    await page.getByRole('button', { name: /の移動$/ }).first().click();
    await page.getByRole('form', { name: /の移動$/ }).getByRole('button', { name: '車へ移動', exact: true }).click();
    const parent = page.getByRole('link', { name: '車割に戻る', exact: true });
    if (await parent.count()) await parent.click();
    await shot(page, viewportName, 14, 'car-allocation-default');
    const assignment = page.getByRole('link', { name: /車へ参加者を割り当て$/ }).first();
    if (await assignment.count()) {
      await assignment.click(); await shot(page, viewportName, 15, 'car-candidate-selection');
      await page.getByRole('link', { name: /車に戻る$/ }).click();
      await page.getByRole('link', { name: '車割に戻る', exact: true }).click();
    }
    await page.getByRole('button', { name: '車を追加', exact: true }).click();
    await shot(page, viewportName, 16, 'car-add-modal');
    console.log('AUDIT car add captured');
    if (await page.getByRole('dialog').count()) await cancelDialog(page);
    console.log('AUDIT car add closed or notice recorded');
    await page.getByRole('button', { name: 'ランダム割り当て', exact: true }).click();
    await shot(page, viewportName, 17, 'car-random-confirmation');
    await cancelDialog(page);
    const allocationMenu = page.getByRole('button', { name: /の操作$/ }).first();
    if (await allocationMenu.count()) { await allocationMenu.click(); await shot(page, viewportName, 18, 'car-row-overflow-open'); await page.keyboard.press('Escape'); }

    await navigateToProjectSection(page, '班割');
    await shot(page, viewportName, 19, 'team-allocation-default');
    await page.getByRole('button', { name: '班を追加', exact: true }).click();
    await shot(page, viewportName, 20, 'team-add-modal');
    await cancelDialog(page);

    await navigateToProjectSection(page, '精算');
    await shot(page, viewportName, 21, 'settlement-default');
    await page.getByRole('link', { name: '精算ルール', exact: true }).click();
    await shot(page, viewportName, 22, 'settlement-rules-page');
    await page.getByRole('textbox', { name: '1台あたりの協力代（円）', exact: true }).fill('-300');
    await page.getByRole('button', { name: '精算ルールを保存', exact: true }).click();
    await shot(page, viewportName, 23, 'settlement-rules-invalid');
    await page.getByRole('heading', { level: 2, name: '計算への影響', exact: true }).scrollIntoViewIfNeeded();
    await shot(page, viewportName, 24, 'settlement-rules-preview');
    await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
    await navigateToProjectSection(page,'精算');await page.getByRole('link',{name:'支払いを確認',exact:true}).click();await page.getByRole('tab',{name:'すべて',exact:true}).click();await page.getByRole('link',{name:/費用を入力$/}).first().click();
    await shot(page, viewportName, 25, 'vehicle-expense-workspace');
    await page.getByRole('button', {name:'費用を追加',exact:true}).click();
    await shot(page, viewportName, 26, 'vehicle-expense-extra-row');
    await page.getByRole('link',{name:'費目一覧に戻る',exact:true}).click();
    await editFee(page,'移動条件');
    await shot(page, viewportName, 27, 'movement-settings-private');
    await page.getByRole('radio',{name:'自家用車',exact:true}).press('ArrowDown');
    await shot(page, viewportName, 28, 'movement-settings-rental');
    await page.getByRole('button',{name:'ルートから距離を計算',exact:true}).click();
    await shot(page, viewportName, 29, 'route-planner-empty');
    await page.getByRole('link',{name:'出発地を検索',exact:true}).click();
    await page.getByRole('searchbox',{name:'場所を検索'}).fill('出発地');
    await expect(page.getByRole('button',{name:/出発地/}).last()).toBeVisible();
    await shot(page,viewportName,30,'route-search-results');
    await page.getByRole('button',{name:/出発地/}).last().click();
    await page.getByRole('link',{name:'目的地を検索',exact:true}).click();
    await page.getByRole('searchbox',{name:'場所を検索'}).fill('目的地');
    await page.getByRole('button',{name:/目的地/}).last().click();
    await expect(page.getByRole('radio',{name:/おすすめ/})).toBeVisible();
    await shot(page,viewportName,31,'route-candidate-selected');
    await page.getByRole('button',{name:'地図を表示',exact:true}).click();
    await shot(page,viewportName,32,'route-map-open');
    await page.getByRole('button',{name:'ルート設定',exact:true}).click();
    await shot(page,viewportName,33,'route-options-open');
    await page.getByRole('button',{name:'この距離を適用',exact:true}).click();
    await shot(page,viewportName,34,'vehicle-expense-after-route');
    await page.getByRole('button',{name:'キャンセル',exact:true}).click();
    const detail=page.getByRole('button',{name:/内訳/}).first();await detail.click();await shot(page,viewportName,35,'settlement-payment-breakdown-open');
    const paid=page.getByRole('checkbox').first();await paid.focus();await paid.press('Space');await shot(page,viewportName,36,'settlement-payment-recorded');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
