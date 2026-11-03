import { test, expect } from '@playwright/test';
import { fixture, createReference } from '../reference.mjs';

async function waitForSavedRoom(request, adminUrl, predicate) {
  await expect.poll(async () => {
    const response = await request.get(adminUrl, { headers: { Authorization: 'Bearer owner' } });
    if (!response.ok()) return false;
    return predicate(await response.json());
  }).toBe(true);
}

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
    await Promise.all([
      expect(pageA.locator('#project-heading')).toHaveText(fixture.roomName),
      expect(pageB.locator('#project-heading')).toHaveText(fixture.roomName),
    ]);
    const headingA = pageA.locator('#project-heading');
    const headingB = pageB.locator('#project-heading');
    await pageB.getByRole('button', { name: 'その他の操作' }).click();
    await pageB.getByRole('menuitem', { name: '企画名を変更' }).click();
    const fieldB = pageB.getByRole('textbox', { name: '企画名' });
    await fieldB.focus();
    await fieldB.dispatchEvent('compositionstart');
    await fieldB.fill('にほんご編集中');
    await pageA.getByRole('button', { name: 'その他の操作' }).click();
    await pageA.getByRole('menuitem', { name: '企画名を変更' }).click();
    const fieldA = pageA.getByRole('textbox', { name: '企画名' });
    await fieldA.fill('別端末で変更');
    await pageA.getByRole('button', { name: '保存', exact: true }).click();
    await expect(pageA.locator('#project-heading')).toHaveText('別端末で変更');
    await waitForSavedRoom(request, adminUrl, saved => saved.roomName === '別端末で変更');
    await expect(fieldB).toHaveValue('にほんご編集中');
    await expect(headingA).toHaveText('別端末で変更');
    await fieldB.dispatchEvent('compositionend', { data: '日本語で確定' });
    await fieldB.fill('日本語で確定');
    await pageB.getByRole('button', { name: '保存', exact: true }).click();
    await expect(headingA).toHaveText('日本語で確定');
    await expect(headingB).toHaveText('日本語で確定');
    const saved = await (await request.get(adminUrl, { headers: { Authorization: 'Bearer owner' } })).json();
    expect(Object.keys(saved.participants)).toHaveLength(6);
    expect(saved.meta.applicationSync).toEqual(fixture.meta.applicationSync);
    await pageB.getByRole('button', { name: 'その他の操作' }).click();
    await pageB.getByRole('menuitem', { name: '企画名を変更' }).click();
    const cancelledDraft = pageB.getByRole('textbox', { name: '企画名' });
    await cancelledDraft.fill('取り消す未保存名');
    await pageA.getByRole('button', { name: 'その他の操作' }).click();
    await pageA.getByRole('menuitem', { name: '企画名を変更' }).click();
    await pageA.getByRole('textbox', { name: '企画名' }).fill('別端末の最新名');
    await pageA.getByRole('button', { name: '保存', exact: true }).click();
    await expect(cancelledDraft).toHaveValue('取り消す未保存名');
    await pageB.getByRole('button', { name: 'キャンセル', exact: true }).click();
    await expect(headingA).toHaveText('別端末の最新名');
    await expect(headingB).toHaveText('別端末の最新名');
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
    await Promise.all([
      expect(pageA.locator('#project-heading')).toHaveText(fixture.roomName),
      expect(pageB.locator('#project-heading')).toHaveText(fixture.roomName),
    ]);

    async function openExpense(page, carHeading = '仮参加者A車', dialogName = carHeading) {
      // The accessible heading now identifies the section as a payment
      // breakdown, so use the car-specific expense action to select the row.
      const action = page.getByRole('button', { name: `${carHeading}の費用を編集`, exact: true });
      await action.click();
      const dialog = page.getByRole('dialog', { name: dialogName });
      await dialog.getByRole('button', { name: '新しい費用を追加', exact: true }).click();
      return dialog;
    }

    async function fillExpense(dialog, name, amount) {
      await dialog.getByLabel('費用名').fill(name);
      await dialog.getByRole('textbox', { name: /金額（円）/ }).fill(amount);
    }

    async function saveExpense(dialog) {
      await dialog.getByRole('button', { name: '保存', exact: true }).click();
      await expect(dialog.getByRole('heading', { name: '費用一覧' })).toBeVisible();
    }

    async function closeExpenseList(dialog) {
      await dialog.locator('.cds--modal-footer').getByRole('button', { name: '閉じる', exact: true }).click();
      await expect(dialog).toHaveCount(0);
    }

    const separateCarDialogA = await openExpense(pageA, '仮参加者A車');
    await fillExpense(separateCarDialogA, '端末A 別車の駐車代', '500');
    const separateCarDialogB = await openExpense(pageB, '仮参加者D車（レンタカー）', '仮参加者D車');
    const separateCarDraftNameB = separateCarDialogB.getByLabel('費用名');
    const separateCarDraftAmountB = separateCarDialogB.getByRole('textbox', { name: /金額（円）/ });
    await separateCarDraftNameB.fill('端末B 別車の入浴代');
    await separateCarDraftAmountB.fill('800');
    await saveExpense(separateCarDialogA);
    await expect(separateCarDialogA.locator('.settlement-cost-summary').getByText('端末A 別車の駐車代', { exact: true })).toBeVisible();
    await waitForSavedRoom(request, adminUrl, saved => Object.values(saved.settlement.carsByParticipantId).some(car => (car.extras || []).some(extra => extra.name === '端末A 別車の駐車代' && extra.amount === '500')));
    await expect(separateCarDialogB).toBeVisible();
    await expect(separateCarDraftNameB).toHaveValue('端末B 別車の入浴代');
    await expect(separateCarDraftAmountB).toHaveValue('800');
    await closeExpenseList(separateCarDialogA);
    await saveExpense(separateCarDialogB);
    await expect(separateCarDialogB.locator('.settlement-cost-summary').getByText('端末B 別車の入浴代', { exact: true })).toBeVisible();
    await waitForSavedRoom(request, adminUrl, saved => Object.values(saved.settlement.carsByParticipantId).some(car => (car.extras || []).some(extra => extra.name === '端末B 別車の入浴代' && extra.amount === '800')));
    await closeExpenseList(separateCarDialogB);

    const dialogA = await openExpense(pageA);
    await fillExpense(dialogA, '端末A 当日駐車代', '600');
    const dialogB = await openExpense(pageB);
    const draftNameB = dialogB.getByLabel('費用名');
    const draftAmountB = dialogB.getByRole('textbox', { name: /金額（円）/ });
    await draftNameB.fill('端末B 当日入浴代');
    await draftAmountB.fill('900');
    await saveExpense(dialogA);
    await expect(dialogA.locator('.settlement-cost-summary').getByText('端末A 当日駐車代', { exact: true })).toBeVisible();
    await waitForSavedRoom(request, adminUrl, saved => Object.values(saved.settlement.carsByParticipantId).some(car => (car.extras || []).some(extra => extra.name === '端末A 当日駐車代' && extra.amount === '600')));
    await expect(dialogB).toBeVisible();
    await expect(draftNameB).toHaveValue('端末B 当日入浴代');
    await expect(draftAmountB).toHaveValue('900');

    await closeExpenseList(dialogA);
    await pageA.getByRole('button', { name: '精算設定' }).click();
    const settings = pageA.getByRole('dialog', { name: '精算設定を編集' });
    await settings.getByText('10円単位', { exact: true }).click();
    await settings.getByRole('button', { name: '次へ' }).click();
    await settings.getByRole('button', { name: '次へ' }).click();
    await settings.getByRole('button', { name: '保存' }).click();
    await expect(settings).toHaveCount(0);
    await waitForSavedRoom(request, adminUrl, saved => saved.settlement.rounding === '10');

    await expect(draftNameB).toHaveValue('端末B 当日入浴代');
    await expect(draftAmountB).toHaveValue('900');
    await saveExpense(dialogB);
    await expect(dialogB.locator('.settlement-cost-summary').getByText('端末B 当日入浴代', { exact: true })).toBeVisible();
    await waitForSavedRoom(request, adminUrl, saved => Object.values(saved.settlement.carsByParticipantId).some(car => (car.extras || []).some(extra => extra.name === '端末B 当日入浴代' && extra.amount === '900')));
    await closeExpenseList(dialogB);

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
    await expect(pageA.locator('#project-heading')).toHaveText(fixture.roomName);
    const refreshedCar = pageA.locator('.settlement-car').filter({ has: pageA.getByRole('button', { name: /^「仮参加者A車」支払い内訳：/ }) });
    await refreshedCar.getByRole('button', { name: /の費用を(?:入力|編集)$/ }).click();
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
