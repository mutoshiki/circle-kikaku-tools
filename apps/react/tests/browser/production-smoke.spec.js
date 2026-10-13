import { test, expect } from '@playwright/test';
import { createReference, fixture } from '../reference.mjs';
import { openRoutePlannerFromMovementSettings, openVehicleExpenseEditor, returnToMovementSettingsFromRoutePlanner } from './settlement-smoke-actions.mjs';

async function seedReleaseSmokeFixture(page, roomId, { savedExpense = true } = {}) {
  const legacyFixture = structuredClone(fixture);
  if (!savedExpense) delete legacyFixture.settlement.cars['仮参加者A'];
  const migratedFixture = createReference().migrateAppData(legacyFixture);
  await page.addInitScript(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
    window.__REACT_ROUTE_ADAPTER__ = {
      async search(query) { return [{ query }]; },
      async resolve(prediction) { return { placeId: prediction.query, name: prediction.query, address: '', latitude: 35, longitude: 139 }; },
      async calculate(state) { return { ...state, routes: [{ id: 'release-smoke-route', label: 'おすすめ', distanceMeters: 12345, durationSeconds: 3600, legs: [{ distanceMeters: 12345, durationSeconds: 3600 }], hasTolls: false, hasHighways: false, tollPrice: '', mainRoads: [] }], selectedRouteIndex: 0, calculatedAt: Date.now() }; },
    };
  }, { key: `sanpo-react:v1:${roomId}:room`, value: migratedFixture });
  await page.goto(`/?room=${roomId}&view=seisan`);
}

test('release fixture opens saved car expenses with the edit action', async ({ page }, testInfo) => {
  const roomId = `RELEASE-SMOKE-SAVED-${testInfo.project.name}`;
  await seedReleaseSmokeFixture(page, roomId);

  const editor = await openVehicleExpenseEditor(page, { carLabel: '仮参加者A車', action: '編集' });
  await expect(editor.getByRole('heading', { name: '費用を編集' })).toBeVisible();
  await editor.getByRole('button', { name: 'ガソリン代の計算条件を編集' }).click();
  await expect(editor.getByRole('heading', { name: 'ガソリン代を設定' })).toBeVisible();
  await openRoutePlannerFromMovementSettings(editor);
  await editor.getByRole('button', { name: /出発地を追加/ }).click();
  const search = editor.getByRole('searchbox', { name: '場所を検索' });
  await search.fill('東京駅');
  await expect(editor.locator('.route-place-results')).toBeVisible();
  await editor.locator('.route-place-results .cds--contained-list-item').first().click();
  await editor.getByRole('button', { name: /目的地を追加/ }).click();
  await search.fill('新宿駅');
  await expect(editor.locator('.route-place-results')).toBeVisible();
  await editor.locator('.route-place-results .cds--contained-list-item').first().click();
  await expect(editor.locator('.route-leg-summary')).toBeVisible();
  await returnToMovementSettingsFromRoutePlanner(editor);
  await expect(editor.getByRole('heading', { name: 'ガソリン代を設定' })).toBeVisible();
  await editor.getByRole('button', { name: 'ガソリン代を適用' }).click();
  await expect(editor.getByRole('heading', { name: '費用を編集' })).toBeVisible();
  await editor.getByRole('button', { name: '費用を保存' }).click();
  await expect(editor).toHaveCount(0);
});

test('release fixture opens a car without saved expenses with the input action', async ({ page }, testInfo) => {
  const roomId = `RELEASE-SMOKE-EMPTY-${testInfo.project.name}`;
  await seedReleaseSmokeFixture(page, roomId, { savedExpense: false });

  const editor = await openVehicleExpenseEditor(page, { carLabel: '仮参加者A車', action: '入力' });
  await expect(editor.getByRole('heading', { name: '費用を編集' })).toBeVisible();
});

test('production preview loads assets and preserves a room edit across critical views and reload', async ({ page }) => {
  const origin = 'http://127.0.0.1:4174';
  const runtimeErrors = [];
  const badResponses = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') runtimeErrors.push(message.text()); });
  page.on('response', response => { if (response.url().startsWith(origin) && response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });

  await page.goto('/?room=PHASE8PRODUCTION');
  await expect(page).toHaveTitle('サークル企画ツール');
  await page.getByRole('button', { name: /^企画名を(設定|変更)$/ }).click();
  const projectName = page.getByRole('textbox', { name: '企画名' });
  await projectName.fill('Phase 8 production smoke');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByRole('tab', { name: '参加者', exact: true }).click();
  await expect(page.getByRole('heading', { name: '参加者', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '参加者を追加', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '人数だけで精算', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '車割', exact: true }).click();
  await expect(page.getByRole('tabpanel', { name: '車割', exact: true }).locator('section.allocation-page')).toBeVisible();
  await page.getByRole('tab', { name: '班割', exact: true }).click();
  await expect(page.getByRole('heading', { name: '班割', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: '精算', exact: true }).click();
  await expect(page.getByRole('tabpanel', { name: '精算', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('#project-heading')).toHaveText('Phase 8 production smoke');
  expect(runtimeErrors).toEqual([]);
  expect(badResponses).toEqual([]);
});
