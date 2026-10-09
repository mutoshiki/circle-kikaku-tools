import { test, expect } from '@playwright/test';
import { fixture, createReference } from '../reference.mjs';

test('two real browsers save through Emulator; an active Japanese draft survives remote rename', async ({ browser, request }, testInfo) => {
  const roomId = `RCBROWSER${testInfo.project.name.startsWith('webkit') ? 'WK' : 'CH'}`;
  const adminUrl = `http://127.0.0.1:9008/rooms/${roomId}.json?ns=demo-circle-react-default-rtdb`;
  const seed = await request.put(adminUrl, { headers: { Authorization: 'Bearer owner' }, data: createReference().migrateAppData(fixture) });
  expect(seed.ok()).toBe(true);
  const a = await browser.newContext(testInfo.project.use);
  const b = await browser.newContext(testInfo.project.use);
  try {
    const pageA = await a.newPage();
    const pageB = await b.newPage();
    const errors = [];
    for (const page of [pageA, pageB]) page.on('pageerror', error => errors.push(error.message));
    await Promise.all([pageA.goto(`http://127.0.0.1:4175/?room=${roomId}`), pageB.goto(`http://127.0.0.1:4175/?room=${roomId}`)]);
    await expect(pageA.locator('.sync-status')).toHaveText('同期完了');
    await expect(pageB.locator('.sync-status')).toHaveText('同期完了');
    const fieldA = pageA.getByRole('textbox', { name: '企画名' });
    const fieldB = pageB.getByRole('textbox', { name: '企画名' });
    await fieldB.focus();
    await fieldB.dispatchEvent('compositionstart');
    await fieldB.fill('にほんご編集中');
    await fieldA.fill('別端末で変更');
    await pageA.getByRole('tab', { name: '参加者', exact: true }).click();
    await expect(pageA.locator('.sync-status')).toHaveText('同期完了');
    await expect.poll(async () => (await (await request.get(adminUrl, { headers: { Authorization: 'Bearer owner' } })).json()).roomName).toBe('別端末で変更');
    await expect(fieldB).toHaveValue('にほんご編集中');
    await fieldB.dispatchEvent('compositionend', { data: '日本語で確定' });
    await fieldB.fill('日本語で確定');
    await pageB.getByRole('tab', { name: '参加者', exact: true }).click();
    await expect(fieldA).toHaveValue('日本語で確定');
    const saved = await (await request.get(adminUrl, { headers: { Authorization: 'Bearer owner' } })).json();
    expect(Object.keys(saved.participants)).toHaveLength(6);
    expect(saved.meta.applicationSync).toEqual(fixture.meta.applicationSync);
    expect(errors).toEqual([]);
  } finally { await Promise.all([a.close(), b.close()]); }
});

test('two real browsers preserve concurrent settlement expenses across cars and on the same car', async ({ browser, request }, testInfo) => {
  const roomId = `RCBSETTLE${testInfo.project.name.startsWith('webkit') ? 'WK' : 'CH'}${Date.now().toString(36).toUpperCase()}`;
  const adminUrl = `http://127.0.0.1:9008/rooms/${roomId}.json?ns=demo-circle-react-default-rtdb`;
  const seed = await request.put(adminUrl, { headers: { Authorization: 'Bearer owner' }, data: createReference().migrateAppData(fixture) });
  expect(seed.ok()).toBe(true);
  const contexts = await Promise.all([browser.newContext(testInfo.project.use), browser.newContext(testInfo.project.use)]);
  try {
    const [pageA, pageB] = await Promise.all(contexts.map(context => context.newPage()));
    const errors = [];
    for (const page of [pageA, pageB]) page.on('pageerror', error => errors.push(error.message));
    await Promise.all([pageA.goto(`http://127.0.0.1:4175/?room=${roomId}`), pageB.goto(`http://127.0.0.1:4175/?room=${roomId}`)]);
    await Promise.all([pageA.getByRole('tab', { name: '精算', exact: true }).click(), pageB.getByRole('tab', { name: '精算', exact: true }).click()]);
    await Promise.all([expect(pageA.locator('.sync-status')).toHaveText('同期完了'), expect(pageB.locator('.sync-status')).toHaveText('同期完了')]);

    async function openExpense(page, carHeading = '仮参加者A車', dialogName = carHeading) {
      const car = page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: carHeading, exact: true }) });
      await car.getByRole('button', { name: '費用を入力', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: dialogName });
      await dialog.getByRole('button', { name: '費用を追加', exact: true }).click();
      return dialog;
    }

    async function fillExpense(dialog, name, amount) {
      await dialog.getByLabel('名目').fill(name);
      await dialog.getByRole('textbox', { name: /金額（円）/ }).fill(amount);
      await dialog.getByRole('button', { name: '費用を追加', exact: true }).click();
    }

    const separateCarDialogA = await openExpense(pageA, '仮参加者A車');
    await fillExpense(separateCarDialogA, '端末A 別車の駐車代', '500');
    const separateCarDialogB = await openExpense(pageB, '仮参加者D車（レンタカー）', '仮参加者D車');
    const separateCarDraftNameB = separateCarDialogB.getByLabel('名目');
    const separateCarDraftAmountB = separateCarDialogB.getByRole('textbox', { name: /金額（円）/ });
    await separateCarDraftNameB.fill('端末B 別車の入浴代');
    await separateCarDraftAmountB.fill('800');
    await separateCarDialogA.getByRole('button', { name: '費用を保存' }).click();
    await expect(separateCarDialogA).toHaveCount(0);
    await expect(pageA.locator('.sync-status')).toHaveText('同期完了');
    await expect(separateCarDialogB).toBeVisible();
    await expect(separateCarDraftNameB).toHaveValue('端末B 別車の入浴代');
    await expect(separateCarDraftAmountB).toHaveValue('800');
    await separateCarDialogB.getByRole('button', { name: '費用を追加', exact: true }).click();
    await separateCarDialogB.getByRole('button', { name: '費用を保存' }).click();
    await expect(separateCarDialogB).toHaveCount(0);
    await expect(pageB.locator('.sync-status')).toHaveText('同期完了');

    const dialogA = await openExpense(pageA);
    await fillExpense(dialogA, '端末A 当日駐車代', '600');
    await expect(dialogA.locator('.settlement-cost-editor').getByText('端末A 当日駐車代', { exact: true })).toBeVisible();
    const dialogB = await openExpense(pageB);
    const draftNameB = dialogB.getByLabel('名目');
    const draftAmountB = dialogB.getByRole('textbox', { name: /金額（円）/ });
    await draftNameB.fill('端末B 当日入浴代');
    await draftAmountB.fill('900');
    await dialogA.getByRole('button', { name: '費用を保存' }).click();
    await expect(dialogA).toHaveCount(0);
    await expect(pageA.locator('.sync-status')).toHaveText('同期完了');
    await expect(dialogB).toBeVisible();
    await expect(draftNameB).toHaveValue('端末B 当日入浴代');
    await expect(draftAmountB).toHaveValue('900');

    await pageA.getByRole('button', { name: '精算設定' }).click();
    const settings = pageA.getByRole('dialog', { name: '精算設定を編集' });
    await settings.getByText('10円単位', { exact: true }).click();
    await settings.getByRole('button', { name: '次へ' }).click();
    await settings.getByRole('button', { name: '次へ' }).click();
    await settings.getByRole('button', { name: '保存' }).click();
    await expect(settings).toHaveCount(0);
    await expect(pageA.locator('.sync-status')).toHaveText('同期完了');

    await expect(draftNameB).toHaveValue('端末B 当日入浴代');
    await expect(draftAmountB).toHaveValue('900');
    await dialogB.getByRole('button', { name: '費用を追加', exact: true }).click();
    await expect(dialogB.locator('.settlement-cost-editor').getByText('端末B 当日入浴代', { exact: true })).toBeVisible();
    await dialogB.getByRole('button', { name: '費用を保存' }).click();
    await expect(dialogB).toHaveCount(0);
    await expect(pageB.locator('.sync-status')).toHaveText('同期完了');

    const response = await request.get(adminUrl, { headers: { Authorization: 'Bearer owner' } });
    expect(response.ok()).toBe(true);
    const saved = await response.json();
    const allExtras = Object.values(saved.settlement.carsByParticipantId).flatMap(car => car.extras || []);
    expect(allExtras).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: '端末A 別車の駐車代', amount: '500' }),
      expect.objectContaining({ name: '端末B 別車の入浴代', amount: '800' }),
      expect.objectContaining({ name: '端末A 当日駐車代', amount: '600' }),
      expect.objectContaining({ name: '端末B 当日入浴代', amount: '900' }),
    ]));
    expect(saved.settlement.rounding).toBe('10');

    await pageA.reload();
    await pageA.getByRole('tab', { name: '精算', exact: true }).click();
    await expect(pageA.locator('.sync-status')).toHaveText('同期完了');
    const refreshedCar = pageA.locator('.settlement-car').filter({ has: pageA.getByRole('heading', { name: '仮参加者A車', exact: true }) });
    await refreshedCar.getByRole('button', { name: '費用を入力', exact: true }).click();
    const refreshedDialog = pageA.getByRole('dialog', { name: '仮参加者A車' });
    await expect(refreshedDialog.locator('.settlement-cost-editor').getByText('端末A 当日駐車代', { exact: true })).toBeVisible();
    await expect(refreshedDialog.locator('.settlement-cost-editor').getByText('端末B 当日入浴代', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map(context => context.close()));
    const cleanup = await request.delete(adminUrl, { headers: { Authorization: 'Bearer owner' } });
    expect(cleanup.ok()).toBe(true);
    expect(await (await request.get(adminUrl, { headers: { Authorization: 'Bearer owner' } })).json()).toBeNull();
  }
});

test('two real browsers preserve concurrently added route places in shared room history', async ({ browser, request }, testInfo) => {
  const roomId = `RCBPLACES${testInfo.project.name.startsWith('webkit') ? 'WK' : 'CH'}${Date.now().toString(36).toUpperCase()}`;
  const adminUrl = `http://127.0.0.1:9008/rooms/${roomId}.json?ns=demo-circle-react-default-rtdb`;
  const room = createReference().migrateAppData(fixture);
  room.settlement.routePlaceCatalog = [];
  const seed = await request.put(adminUrl, { headers: { Authorization: 'Bearer owner' }, data: room });
  expect(seed.ok()).toBe(true);
  const contexts = await Promise.all([browser.newContext(testInfo.project.use), browser.newContext(testInfo.project.use)]);
  try {
    await Promise.all(contexts.map(context => context.addInitScript(() => {
      window.__REACT_ROUTE_ADAPTER__ = {
        async search(query) { return [{ placeId: `shared-${query}`, name: query, address: `${query}の住所`, latitude: 35.5, longitude: 139.5 }]; },
        async resolve(prediction) { return prediction; },
        async calculate(state) { return { ...state, routes: [], selectedRouteIndex: 0 }; },
      };
    })));
    const [pageA, pageB] = await Promise.all(contexts.map(context => context.newPage()));
    const errors = [];
    for (const page of [pageA, pageB]) page.on('pageerror', error => errors.push(error.message));
    await Promise.all([pageA.goto(`http://127.0.0.1:4175/?room=${roomId}`), pageB.goto(`http://127.0.0.1:4175/?room=${roomId}`)]);
    await Promise.all([pageA.getByRole('tab', { name: '精算', exact: true }).click(), pageB.getByRole('tab', { name: '精算', exact: true }).click()]);
    await Promise.all([expect(pageA.locator('.sync-status')).toHaveText('同期完了'), expect(pageB.locator('.sync-status')).toHaveText('同期完了')]);

    async function openRoute(page) {
      const car = page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: '仮参加者A車', exact: true }) });
      await car.getByRole('button', { name: '費用を入力', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: '仮参加者A車' });
      await dialog.getByRole('button', { name: 'ガソリン代の操作' }).click();
      await page.getByRole('menuitem', { name: '計算条件を編集' }).click();
      await dialog.getByRole('button', { name: '移動距離計算ツール' }).click();
      await dialog.getByRole('button', { name: /出発地を追加/ }).click();
      return dialog;
    }
    const [dialogA, dialogB] = await Promise.all([openRoute(pageA), openRoute(pageB)]);
    const searchA = dialogA.getByRole('searchbox', { name: '場所を検索' });
    const searchB = dialogB.getByRole('searchbox', { name: '場所を検索' });
    await Promise.all([searchA.fill('端末A共有場所'), searchB.fill('端末B共有場所')]);
    await Promise.all([
      expect(dialogA.locator('.route-place-results')).toContainText('端末A共有場所'),
      expect(dialogB.locator('.route-place-results')).toContainText('端末B共有場所'),
    ]);
    await Promise.all([
      dialogA.locator('.route-place-results').getByText('端末A共有場所', { exact: true }).click(),
      dialogB.locator('.route-place-results').getByText('端末B共有場所', { exact: true }).click(),
    ]);
    await Promise.all([expect(pageA.locator('.sync-status')).toHaveText('同期完了'), expect(pageB.locator('.sync-status')).toHaveText('同期完了')]);

    await expect.poll(async () => {
      const saved = await (await request.get(adminUrl, { headers: { Authorization: 'Bearer owner' } })).json();
      return (saved?.settlement?.routePlaceCatalog || []).map(place => place.placeId).sort();
    }).toEqual(['shared-端末A共有場所', 'shared-端末B共有場所'].sort());
    const origin = dialogB.locator('.route-stop-list').getByRole('button', { name: /出発地 端末B共有場所/ });
    await expect(origin).toBeVisible();
    await origin.click();
    await expect(dialogB.locator('.route-place-results')).toContainText('端末A共有場所');
    await expect(dialogB.locator('.route-place-results')).toContainText('端末B共有場所');
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map(context => context.close()));
    const cleanup = await request.delete(adminUrl, { headers: { Authorization: 'Bearer owner' } });
    expect(cleanup.ok()).toBe(true);
    expect(await (await request.get(adminUrl, { headers: { Authorization: 'Bearer owner' } })).json()).toBeNull();
  }
});
