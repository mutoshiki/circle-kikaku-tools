import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { navigateToProjectSection } from './project-navigation.js';
import { editFee } from './vehicle-cost-fixture.js';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/legacy-v4.json', import.meta.url)));
const token = `h_${'R'.repeat(48)}`;

test.beforeEach(async ({ page }, testInfo) => {
  const roomId = `PHASE6-${testInfo.project.name}-${testInfo.retry}`;
  await page.addInitScript(({ key, value }) => {
    if (!sessionStorage.getItem(`seed:${key}`)) {
      localStorage.setItem(key, JSON.stringify(value));
      sessionStorage.setItem(`seed:${key}`, '1');
    }
    window.__REACT_ROUTE_ADAPTER__ = {
      async search(query) { return query === 'なし' ? [] : [{ query }]; },
      async resolve(prediction) { return { placeId: prediction.query, name: prediction.query, address: '', latitude: prediction.query === '出発地' ? 35 : 36, longitude: prediction.query === '出発地' ? 139 : 140 }; },
      async calculate(state) { return { ...state, routes: [{ id: 'fixture-route', label: 'おすすめ', distanceMeters: 12345, durationSeconds: 3600, legs: [{ distanceMeters: 12345, durationSeconds: 3600 }], hasTolls: false, hasHighways: false, tollPrice: '', mainRoads: [] }], selectedRouteIndex: 0, calculatedAt: Date.now() }; },
    };
    window.__REACT_EXTERNAL_ADAPTERS__ = {
      async handoff() { return { ok: true, filename: '参加者.csv', participants: [{ studentId: 'S001', name: '仮参加者A' }] }; },
      async bugReport(payload) { window.__phase6BugReport = payload; return { ok: true }; },
    };
  }, { key: `sanpo-react:v1:${roomId}:room`, value: fixture });
  await page.goto(`/?room=${roomId}&view=sheet&allocation=car&handoff=${token}`);
  await expect(page).toHaveURL(new RegExp(`\\?room=${roomId}&section=organization-car$`));
});

test('guidance, CSV, utility report, notifications and URL security', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await navigateToProjectSection(page, '参加者');
  let saved = await page.evaluate(roomId => JSON.parse(localStorage.getItem(`sanpo-react:v1:${roomId}:room`)), new URL(page.url()).searchParams.get('room'));
  expect(saved.meta.applicationSync.title).toBe(fixture.meta.applicationSync.title);

  await page.getByRole('link', { name: '発表文を作成' }).click();
  const guidance = page.getByRole('form', { name: '参加者発表文を作成' });
  await guidance.getByLabel('集合時間').fill('08:30');
  await expect(guidance.getByLabel('発表文プレビュー')).toHaveValue(/参加者を発表します/);
  await page.getByRole('link', { name: '参加者に戻る', exact: true }).click();

  await page.getByRole('button', { name: '引き継ぎデータを作成' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('dialog', { name: '引き継ぎデータ' }).getByRole('button', { name: '引き継ぎデータを作成' }).click();
  expect((await download).suggestedFilename()).toBe('参加者.csv');

  await page.getByRole('button', { name: 'ユーティリティメニュー' }).click();
  await page.getByRole('menuitem', { name: 'バグを報告する' }).click();
  await page.getByLabel('バグの内容').fill('fixture only');
  await page.getByRole('dialog', { name: 'バグを報告' }).getByRole('button', { name: '送信' }).click();
  expect(await page.evaluate(() => window.__phase6BugReport?.message)).toBe('fixture only');
  expect(await page.evaluate(() => location.href.includes('handoff'))).toBe(false);
  expect(JSON.stringify(saved)).not.toContain(token);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('failed handoff stays inside the dialog until retry succeeds', async ({ page }) => {
  await page.addInitScript(() => {
    let attempts = 0;
    window.__REACT_EXTERNAL_ADAPTERS__ = {
      async handoff() {
        if (++attempts === 1) throw new Error('引き継ぎ接続を確認してください。');
        return { ok: true, filename: '再試行.csv', participants: [{ studentId: 'S001', name: '仮参加者A' }] };
      },
    };
  });
  await page.reload();
  await navigateToProjectSection(page, '参加者');
  await page.getByRole('button', { name: '引き継ぎデータを作成', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '引き継ぎデータ', exact: true });
  const submit = dialog.getByRole('button', { name: '引き継ぎデータを作成', exact: true });
  await submit.click();
  await expect(dialog.getByRole('status')).toContainText('引き継ぎ接続を確認してください。');
  const download = page.waitForEvent('download');
  await submit.click();
  expect((await download).suggestedFilename()).toBe('再試行.csv');
  await expect(dialog).toBeHidden();
});

test('route draft stays local and selected distance alone enters shared settlement',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await navigateToProjectSection(page,'精算');
  await page.locator('.settlement-car').first().getByRole('button',{name:/費用を入力$/}).click();await editFee(page,'移動条件');
  await page.getByRole('button',{name:'ルートから距離を計算',exact:true}).click();
  await page.getByRole('link',{name:'出発地を検索',exact:true}).click();await page.getByRole('searchbox',{name:'場所を検索'}).fill('なし');
  await expect(page.getByText('一致する場所がありません。')).toBeVisible();
  await page.getByRole('searchbox',{name:'場所を検索'}).fill('出発地');await page.getByRole('button',{name:'出発地',exact:true}).click();
  await page.getByRole('link',{name:'目的地を検索',exact:true}).click();await page.getByRole('searchbox',{name:'場所を検索'}).fill('目的地');await page.getByRole('button',{name:'目的地',exact:true}).click();
  await expect(page.getByRole('radio',{name:/おすすめ/})).toBeChecked();
  await page.getByRole('button',{name:'ルート設定',exact:true}).click();await page.getByText('有料道路を使う',{exact:true}).click();
  await expect(page.getByRole('checkbox',{name:'高速道路を使う'})).not.toBeChecked();
  await page.getByRole('button',{name:'この距離を適用',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'走行距離（km）'})).toHaveValue('12.3');
  await page.getByRole('button',{name:'車両費用を保存',exact:true}).click();
  const state=await page.evaluate(()=>({room:JSON.parse(localStorage.getItem(`sanpo-react:v1:${new URL(location.href).searchParams.get('room')}:room`)),route:JSON.parse(localStorage.getItem(`sanpo.routePlannerState.v2:${new URL(location.href).searchParams.get('room')}`))}));
  expect(JSON.stringify(state.room)).not.toContain('fixture-route');expect(JSON.stringify(state.room)).not.toContain(token);expect(state.route.routes[0].id).toBe('fixture-route');
  await page.reload();await page.locator('.settlement-car').first().getByRole('button',{name:/費用を入力$/}).click();await editFee(page,'移動条件');
  await expect(page.getByRole('textbox',{name:'走行距離（km）'})).toHaveValue('12.3');await page.getByRole('button',{name:'キャンセル',exact:true}).click();
  await page.getByRole('button',{name:'ユーティリティメニュー'}).click();await page.getByRole('menuitem',{name:'ダークモードに切り替え'}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
