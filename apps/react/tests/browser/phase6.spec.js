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
  await expect(guidance.getByLabel('発表文プレビュー')).toHaveValue(/参加者を発表します/);
  await guidance.getByRole('button', { name: '閉じる' }).click();

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

test('route draft stays local and selected distance alone enters shared settlement', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.getByRole('tab', { name: '精算', exact: true }).click();
  await page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) }).getByRole('button', { name: '費用を編集' }).click();
  const car = page.getByRole('dialog', { name: '仮参加者A車' });
  await car.getByRole('button', { name: '費用を追加' }).click();
  const addedExpenseDelete = car.getByRole('button', { name: '削除', exact: true }).last();
  await expect(addedExpenseDelete).toHaveClass(/cds--btn--danger--ghost/);
  await addedExpenseDelete.click();
  await car.locator('.settlement-cost-list-item').filter({ hasText: 'ガソリン代' }).click();
  await car.getByRole('button', { name: 'ルートから距離を計算' }).click();
  const route = page.getByRole('dialog', { name: '仮参加者A車' });
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await route.getByRole('button', { name: /出発地を追加/ }).click();
  await route.getByRole('searchbox', { name: '場所を検索' }).fill('なし');
  await expect(route.getByText('一致する場所がありません。', { exact: true })).toBeVisible();
  await route.getByRole('searchbox', { name: '場所を検索' }).fill('出発地');
  await expect(route.locator('.route-place-results.cds--contained-list')).toBeVisible();
  await route.getByRole('button', { name: /出発地/ }).last().click();
  await route.getByRole('button', { name: /目的地を追加/ }).click();
  await route.getByRole('searchbox', { name: '場所を検索' }).fill('目的地');
  await route.getByRole('button', { name: /目的地/ }).last().click();
  await expect(route.getByRole('radio', { name: /おすすめ 12\.35 km/ })).toBeVisible();
  await expect(route.getByRole('button', { name: '地図を表示' })).toHaveClass(/cds--btn--tertiary/);
  await route.getByRole('button', { name: 'ルート設定' }).click();
  const tolls = route.getByRole('checkbox', { name: '有料道路を使う' });
  const highways = route.getByRole('checkbox', { name: '高速道路を使う' });
  await tolls.check({ force: true });
  await expect(highways).not.toBeChecked();
  await route.getByRole('button', { name: /合計 12\.35km を適用/ }).click();
  await expect(car.getByLabel('移動距離（km）')).toHaveValue('12.3');
  await car.getByRole('button', { name: 'ガソリン代を適用' }).click();
  await car.getByRole('button', { name: '保存' }).click();
  await expect(car).toHaveCount(0);
  const state = await page.evaluate(roomId => ({ room: JSON.parse(localStorage.getItem(`sanpo-react:v1:${roomId}:room`)), route: JSON.parse(localStorage.getItem(`sanpo.routePlannerState.v2:${roomId}`)) }), new URL(page.url()).searchParams.get('room'));
  expect(JSON.stringify(state.room)).not.toContain('fixture-route');
  expect(state.route.routes[0].id).toBe('fixture-route');
  expect(JSON.stringify(state.room)).not.toContain(token);
  await page.reload(); await page.getByRole('tab', { name: '精算', exact: true }).click(); await page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) }).getByRole('button', { name: '費用を編集' }).click();
  const reopened = page.getByRole('dialog', { name: '仮参加者A車' });
  await reopened.locator('.settlement-cost-list-item').filter({ hasText: 'ガソリン代' }).click();
  await expect(reopened.getByLabel('移動距離（km）')).toHaveValue('12.3');
  await reopened.locator('.cds--modal-close').click();
  await page.getByRole('button', { name: 'ユーティリティメニュー' }).click(); await page.getByRole('menuitem', { name: 'ダークモードに切り替え' }).click();
  await expect(page.locator('.application')).toHaveClass(/cds--g100/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
