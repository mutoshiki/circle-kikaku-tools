import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/legacy-v4.json', import.meta.url)));
const pageErrors = new WeakMap();
const browserConsoleIssues = new WeakMap();

async function openCarExpenseEditor(car) {
  await car.getByRole('button', { name: '費用を入力', exact: true }).click();
}

test.beforeEach(async ({ page }, testInfo) => {
  const errors = [];
  const consoleIssues = [];
  pageErrors.set(page, errors);
  browserConsoleIssues.set(page, consoleIssues);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'warning' || message.type() === 'error') consoleIssues.push(`${message.type()}: ${message.text()}`); });
  const roomId = `SETTLEMENT-${testInfo.project.name}-${testInfo.retry}`;
  const initialFixture = structuredClone(fixture);
  if (testInfo.title === 'settlement rows wrap long car names and format zero amount') {
    const oldName = initialFixture.cars[0].name;
    const longName = 'とても長い確認用のレンタカー車名とても長い確認用のレンタカー車名';
    initialFixture.cars[0].name = longName;
    initialFixture.settlement.cars[longName] = { ...initialFixture.settlement.cars[oldName], dist: '0.01', extras: [] };
    delete initialFixture.settlement.cars[oldName];
    if (Object.hasOwn(initialFixture.settlement.driverPaid, oldName)) {
      initialFixture.settlement.driverPaid[longName] = initialFixture.settlement.driverPaid[oldName];
      delete initialFixture.settlement.driverPaid[oldName];
    }
    initialFixture.settlement.driverReward = '0';
    initialFixture.settlement.driverCollectionOffset = false;
  }
  if (testInfo.title === 'missing fuel settings do not show error notifications before the user opens a car') {
    initialFixture.settlement.cars['仮参加者A'] = {
      ...initialFixture.settlement.cars['仮参加者A'],
      dist: '',
      eco: '',
      price: '',
      extras: [
        ...initialFixture.settlement.cars['仮参加者A'].extras,
        { id: 'pending-check', name: '', amount: '', type: 'split', pending: true },
      ],
    };
  }
  if (testInfo.title === 'car expense candidates omit costs already on the current car') {
    initialFixture.settlement.cars['仮参加者A'].extras.push({ id: 'parking-a-shared', name: '駐車場', amount: '200', type: 'split' });
    initialFixture.settlement.cars['仮参加者D'].extras.push({ id: 'parking-d-shared', name: '駐車場', amount: '200', type: 'split' });
  }
  if (testInfo.title.startsWith('incomplete movement settings')) {
    initialFixture.settlement.cars['仮参加者A'] = {
      ...initialFixture.settlement.cars['仮参加者A'],
      dist: '',
      eco: '',
      price: '',
    };
  }
  if (testInfo.title.startsWith('Times movement settings')) {
    initialFixture.settlement.cars['仮参加者A'] = {
      ...initialFixture.settlement.cars['仮参加者A'],
      rentalType: 'times',
      dist: '',
      eco: '',
      price: '',
    };
  }
  if (testInfo.title.startsWith('unrelated expenses save while movement cost is uncalculated')) {
    initialFixture.settlement.cars['仮参加者A'] = {
      ...initialFixture.settlement.cars['仮参加者A'],
      dist: '',
      eco: '',
      price: '',
    };
  }
  if (testInfo.title === 'collection uses a Carbon modal with one scrolling body, filters, copy, and excluded labels' || testInfo.title.startsWith('settlement responsive layout')) {
    initialFixture.settlement.organizerFree = true;
    initialFixture.cars[0].members.push(...Array.from({ length: 18 }, (_, index) => ({ name: `検証参加者${index + 1}`, grade: 1 })));
  }
  await page.addInitScript(({ key, value }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value)); }, {
    key: `sanpo-react:v1:${roomId}:room`, value: initialFixture,
  });
  if (testInfo.title === 'settlement WebKit text and control size audit') {
    await page.addInitScript(({ key, value }) => { localStorage.setItem(key, JSON.stringify(value)); }, {
      key: `sanpo.routePlannerState.v2:${roomId}`,
      value: {
        origin: { placeId: 'audit-origin', name: '出発地', address: '長野県松本市', latitude: 36.24, longitude: 137.97 },
        waypoints: [{ placeId: 'audit-waypoint', name: '経由地', address: '長野県安曇野市', latitude: 36.3, longitude: 137.9 }],
        destination: { placeId: 'audit-destination', name: '目的地', address: '長野県大町市', latitude: 36.5, longitude: 137.8 },
        routes: [{ id: 'audit-route', label: 'おすすめ', distanceMeters: 24000, durationSeconds: 3600, legs: [{ fromName: '出発地', toName: '経由地', distanceMeters: 12000, durationSeconds: 1800 }, { fromName: '経由地', toName: '目的地', distanceMeters: 12000, durationSeconds: 1800 }] }],
        selectedRouteIndex: 0,
        recentPlaces: [],
      },
    });
  }
  await page.goto(`/?room=${roomId}`);
  await page.getByRole('tab', { name: '精算', exact: true }).click();
});

test.afterEach(async ({ page }) => {
  expect(browserConsoleIssues.get(page)).toEqual([]);
});

test('settings cancel/save, signed extras, collection state and reload', async ({ page }) => {
  await expect(page.getByRole('heading', { name: '各車への支払い' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '集金チェック' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '精算状況' })).toHaveCount(0);
  await expect(page.getByText('精算モード', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: '精算設定' }).click();
  let settings = page.getByRole('dialog', { name: '精算設定を編集' });
  await settings.getByText('10円単位', { exact: true }).click();
  await page.getByRole('button', { name: 'キャンセル' }).click();
  await page.getByRole('button', { name: '精算設定' }).click();
  settings = page.getByRole('dialog', { name: '精算設定を編集' });
  await expect(settings.getByRole('radio', { name: '100円単位' })).toBeChecked();
  await page.getByRole('button', { name: 'キャンセル' }).click();

  await page.getByRole('button', { name: '精算設定' }).click();
  settings = page.getByRole('dialog', { name: '精算設定を編集' });
  await settings.getByRole('button', { name: '次へ' }).click();
  await settings.getByRole('button', { name: '次へ' }).click();
  await expect(settings.getByRole('radio', { name: '支払額から差し引く' })).toBeVisible();
  await page.getByRole('button', { name: 'キャンセル' }).click();

  await page.getByRole('button', { name: '精算設定' }).click();
  settings = page.getByRole('dialog', { name: '精算設定を編集' });
  await settings.getByText('10円単位', { exact: true }).click();
  await settings.getByRole('button', { name: '次へ' }).click();
  await settings.getByLabel('1台あたりの協力代（円）').fill('700');
  await settings.getByRole('button', { name: '次へ' }).click();
  await settings.getByRole('button', { name: '保存' }).click();
  await page.getByRole('button', { name: '精算設定' }).click();
  settings = page.getByRole('dialog', { name: '精算設定を編集' });
  await expect(settings.getByRole('radio', { name: '10円単位' })).toBeChecked();
  await page.getByRole('button', { name: 'キャンセル' }).click();

  await openCarExpenseEditor(page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) }));
  await page.getByRole('button', { name: '新しい費用を追加' }).click();
  const modal = page.getByRole('dialog', { name: '仮参加者A車' });
  const lastRow = modal.locator('.settlement-cost-editor-form');
  await lastRow.getByLabel('名目').dispatchEvent('compositionstart');
  await lastRow.getByLabel('名目').fill('にほんごへんかんちゅう');
  await lastRow.getByLabel('名目').dispatchEvent('compositionend', { data: '日本語変換中の返金' });
  await lastRow.getByLabel('名目').fill('日本語変換中の返金');
  await lastRow.getByRole('textbox', { name: /金額（円）/ }).fill('300');
  await lastRow.getByText('部費', { exact: true }).click();
  await lastRow.getByRole('checkbox', { name: /^(?:部費|割勘)の費用から差し引く$/ }).check({ force: true });
  await modal.getByRole('button', { name: '費用を追加', exact: true }).click();
  await expect(modal.locator('.settlement-cost-editor')).toBeVisible();
  await modal.getByRole('button', { name: '費用を保存' }).click();
  const carA = page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) });
  await carA.getByRole('button', { name: /割勘 .*・部費/ }).click();
  await expect(carA.getByText('日本語変換中の返金')).toBeVisible();

  await page.getByRole('button', { name: '集金を確認' }).click();
  await page.getByRole('tab', { name: 'すべて' }).click();
  await page.locator('label[for="settlement-paid-仮参加者C"]').click();
  await expect(page.getByRole('dialog', { name: '集金済みにする' })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: '仮参加者Cの集金チェック' })).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '集金を確認' })).toHaveCount(0);
  const driverPaidBefore = await page.evaluate(() => JSON.parse(localStorage.getItem(`sanpo-react:v1:${new URL(location.href).searchParams.get('room')}:room`)).settlement.driverPaid);

  await page.reload();
  await page.getByRole('tab', { name: '精算', exact: true }).click();
  await page.getByRole('button', { name: '精算設定' }).click();
  settings = page.getByRole('dialog', { name: '精算設定を編集' });
  await expect(settings.getByRole('radio', { name: '10円単位' })).toBeChecked();
  await page.getByRole('button', { name: 'キャンセル' }).click();
  const reloadedCarA = page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) });
  await reloadedCarA.getByRole('button', { name: /割勘 .*・部費/ }).click();
  await expect(reloadedCarA.getByText('日本語変換中の返金')).toBeVisible();
  await page.getByRole('button', { name: '集金を確認' }).click();
  await page.getByRole('tab', { name: 'すべて' }).click();
  await expect(page.getByRole('checkbox', { name: '仮参加者Cの集金チェック' })).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '集金を確認' })).not.toBeVisible();
  const driverPaidAfter = await page.evaluate(() => JSON.parse(localStorage.getItem(`sanpo-react:v1:${new URL(location.href).searchParams.get('room')}:room`)).settlement.driverPaid);
  expect(driverPaidAfter).toEqual(driverPaidBefore);
  await expect(page.locator('.settlement-car .settlement-payment-state')).toHaveCount(0);
  await page.getByRole('button', { name: 'ユーティリティメニュー' }).click(); await page.getByRole('menuitem', { name: 'ダークモードに切り替え' }).click();
  await expect(page.locator('.application')).toHaveClass(/cds--g100/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(pageErrors.get(page)).toEqual([]);
});

test('missing fuel settings do not show error notifications before the user opens a car', async ({ page }, testInfo) => {
  await expect(page.getByRole('heading', { name: '各車への支払い' })).toBeVisible();
  await expect(page.getByText(/ガソリン代を計算するため、.*を入力してください。/)).toHaveCount(0);
  const car = page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) });
  await expect(car.locator('.cds--tag').getByText('費用未入力', { exact: true })).toBeVisible();
  await expect(page.locator('.settlement-page > .cds--inline-notification')).toHaveCount(0);

  await openCarExpenseEditor(page.locator('.settlement-car').first());
  const dialog = page.getByRole('dialog', { name: '仮参加者A車' });
  await expect(dialog.locator('.cds--inline-notification')).toHaveCount(0);
  await dialog.getByRole('button', { name: '費用を保存' }).click();
  await expect(dialog.locator('.settlement-cost-editor-form')).toBeVisible();
  await expect(dialog.locator('.settlement-cost-editor-form input').first()).toHaveAttribute('aria-invalid', 'true');
  await expect(dialog.locator('.settlement-cost-editor-form input').nth(1)).toHaveAttribute('aria-invalid', 'true');
  await expect(dialog.getByText(/ガソリン代を計算するため/)).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('extra-fields-invalid.png'), animations: 'disabled' });
});

test('incomplete movement settings stay uncalculated, explain required fields, and preserve the draft on back', async ({ page }, testInfo) => {
  await openCarExpenseEditor(page.locator('.settlement-car').first());
  const dialog = page.getByRole('dialog', { name: '仮参加者A車' });
  await dialog.getByRole('button', { name: 'ガソリン代の計算条件を編集' }).click();

  const distance = dialog.locator('#settlement-distance');
  const efficiency = dialog.locator('#settlement-eco');
  const price = dialog.locator('#settlement-price');
  const apply = dialog.getByRole('button', { name: 'ガソリン代を適用' });
  await expect(dialog.getByRole('heading', { name: 'ガソリン代を設定' })).toBeVisible();
  await expect(dialog.locator('.settlement-movement-preview')).toContainText('未計算');
  await expect(dialog.locator('.settlement-movement-preview')).not.toContainText('¥0');
  await expect(apply).toBeDisabled();
  await expect(dialog.getByText('ガソリン代を適用するには、移動距離・燃費・ガソリン単価を入力してください。')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('movement-incomplete.png'), animations: 'disabled' });

  await distance.fill('500');
  await efficiency.fill('12');
  await price.focus();
  await efficiency.press('Tab');
  await expect(price).toHaveAttribute('aria-invalid', 'true');
  await expect(dialog.getByText('ガソリン単価を入力してください。', { exact: true })).toBeVisible();
  await expect(apply).toBeDisabled();
  await dialog.getByRole('button', { name: '戻る' }).click();
  await expect(dialog.getByRole('heading', { name: '費用を編集' })).toBeVisible();
  await expect(dialog.locator('.settlement-cost-summary').filter({ hasText: 'ガソリン代' })).toContainText('未計算');

  await dialog.getByRole('button', { name: 'ガソリン代の計算条件を編集' }).click();
  await expect(distance).toHaveValue('500');
  await expect(efficiency).toHaveValue('12');
  await expect(price).toHaveValue('');
  await price.fill('170');
  await expect(apply).toBeEnabled();
  await dialog.locator('.cds--modal-content').evaluate(node => { node.scrollTop = node.scrollHeight; });
  await page.screenshot({ path: testInfo.outputPath('movement-complete.png'), animations: 'disabled' });
  await apply.click();
  await expect(dialog.getByRole('heading', { name: '費用を編集' })).toBeVisible();
  await expect(dialog.locator('.settlement-cost-summary').filter({ hasText: 'ガソリン代' })).toContainText('¥7,083');
});

test('clearing a newly added expense keeps required fields invalid until corrected', async ({ page }) => {
  await openCarExpenseEditor(page.locator('.settlement-car').first());
  const dialog = page.getByRole('dialog', { name: '仮参加者A車' });
  await dialog.getByRole('button', { name: '新しい費用を追加', exact: true }).click();

  const name = dialog.getByLabel('名目');
  const amount = dialog.getByRole('textbox', { name: /金額（円）/ });
  await name.fill('一時費用');
  await amount.fill('100');
  await name.fill('');
  await amount.fill('');

  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await expect(amount).toHaveAttribute('aria-invalid', 'true');
  await expect(dialog.getByRole('button', { name: '費用を追加', exact: true })).toBeDisabled();
  await expect(dialog.getByText('名目を入力してください。', { exact: true })).toBeVisible();
  await expect(dialog.getByText('金額を入力してください。', { exact: true })).toBeVisible();
});

test('Times movement settings require only distance and apply the calculated amount', async ({ page }) => {
  await openCarExpenseEditor(page.locator('.settlement-car').first());
  const dialog = page.getByRole('dialog', { name: '仮参加者A車' });
  await dialog.getByRole('button', { name: 'タイムズ移動料金の計算条件を編集' }).click();

  const distance = dialog.locator('#settlement-distance');
  const apply = dialog.getByRole('button', { name: 'タイムズ移動料金を適用' });
  await expect(dialog.getByRole('heading', { name: 'タイムズ移動料金を設定' })).toBeVisible();
  await expect(dialog.locator('.settlement-movement-preview')).toContainText('未計算');
  await expect(dialog.getByText('タイムズ移動料金を適用するには、移動距離を入力してください。')).toBeVisible();
  await expect(dialog.locator('#settlement-eco')).toHaveCount(0);
  await expect(dialog.locator('#settlement-price')).toHaveCount(0);
  await expect(apply).toBeDisabled();

  await distance.fill('100');
  await expect(apply).toBeEnabled();
  await dialog.locator('.cds--modal-content').evaluate(node => { node.scrollTop = node.scrollHeight; });
  await apply.click();
  await expect(dialog.getByRole('heading', { name: '費用を編集' })).toBeVisible();
  await expect(dialog.locator('.settlement-cost-summary').filter({ hasText: 'タイムズ移動料金' })).not.toContainText('未計算');
});

test('unrelated expenses save while movement cost is uncalculated and collection stays provisional', async ({ page }, testInfo) => {
  await openCarExpenseEditor(page.locator('.settlement-car').first());
  const dialog = page.getByRole('dialog', { name: '仮参加者A車' });
  await dialog.getByRole('button', { name: '新しい費用を追加', exact: true }).click();
  await dialog.getByLabel('名目').fill('温泉代');
  await dialog.getByRole('textbox', { name: /金額（円）/ }).fill('1650');
  await dialog.getByRole('button', { name: '費用を追加', exact: true }).click();
  await expect(dialog.locator('.settlement-cost-summary').filter({ hasText: 'ガソリン代' })).toContainText('未計算');
  await expect(dialog.locator('.settlement-cost-summary').filter({ hasText: '温泉代' })).toContainText('¥1,650');
  await dialog.getByRole('button', { name: '費用を保存' }).click();
  await expect(dialog).toHaveCount(0);

  const car = page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) });
  await expect(car.locator('.cds--tag').getByText('ガソリン代未計算', { exact: true })).toBeVisible();
  await car.getByRole('button', { name: /割勘/ }).click();
  await expect(car.getByText('未計算', { exact: true })).toBeVisible();
  await expect(car.getByText('温泉代')).toBeVisible();

  await page.getByRole('button', { name: '集金を確認' }).click();
  const collection = page.getByRole('dialog', { name: '集金を確認' });
  await expect(collection.locator('.cds--inline-notification')).toContainText('移動費が未計算、または入力が未完了の費用があります。');
  await expect(collection.getByText('未確定', { exact: true }).first()).toBeVisible();
  const firstUnpaidCheckbox = collection.getByRole('checkbox').first();
  await expect(firstUnpaidCheckbox).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath('collection-provisional.png'), animations: 'disabled' });
});

test('registered-participant collection records directly without asking for a collector', async ({ page }) => {
  await page.getByRole('button', { name: '集金を確認' }).click();
  const collection = page.getByRole('dialog', { name: '集金を確認' });
  await collection.getByRole('tab', { name: 'すべて' }).click();
  await page.locator('label[for="settlement-paid-仮参加者C"]').click();
  await expect(page.getByRole('dialog', { name: '集金済みにする' })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: '仮参加者Cの集金チェック' })).toBeChecked();
  expect(pageErrors.get(page)).toEqual([]);
});

test('collection uses a Carbon modal with one scrolling body, filters, copy, and excluded labels', async ({ page }) => {
  const isChromium = page.context().browser().browserType().name() === 'chromium';
  if (isChromium) await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const viewportHeight = await page.evaluate(() => innerHeight);
  await expect(page.getByRole('button', { name: '集金を確認' })).toBeVisible();
  const dialog = page.getByRole('dialog', { name: '集金を確認' });
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: '集金を確認' }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('tab', { name: '未回収' })).toHaveAttribute('aria-selected', 'true');
  await expect(dialog.getByText(/集金\s*\d+\/\d+人/)).toHaveCount(0);
  await expect(dialog.getByText(/残り\s*¥/)).toHaveCount(0);
  await expect(dialog.getByText('集金不要', { exact: true })).toHaveCount(0);
  await dialog.getByRole('tab', { name: 'すべて' }).click();
  await expect(page.getByRole('button', { name: '集金を確認' })).toHaveAttribute('aria-controls', 'settlement-collection-modal');
  await expect(dialog.getByRole('list', { name: '集金対象者' })).toBeVisible();
  const initialModalLayout = await dialog.evaluate(node => {
    const rect = element => {
      const { x, y, width, height, right, bottom } = element.getBoundingClientRect();
      return { x, y, width, height, right, bottom };
    };
    const row = node.querySelector('.settlement-collection-row:not(.excluded)');
    const list = node.querySelector('.settlement-collection-list');
    const scrollBody = node.querySelector('.cds--modal-content');
    return {
      viewport: { width: innerWidth, height: innerHeight },
      page: { width: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth },
      modal: rect(node), body: rect(scrollBody), bodyScroll: { clientHeight: scrollBody.clientHeight, scrollHeight: scrollBody.scrollHeight, overflowY: getComputedStyle(scrollBody).overflowY },
      list: { overflowY: getComputedStyle(list).overflowY, scrollHeight: list.scrollHeight, clientHeight: list.clientHeight },
      row: rect(row), rowText: rect(row.querySelector('.cds--contained-list-item__content')),
      action: rect(row.querySelector('.cds--contained-list-item__action')),
      checkbox: rect(row.querySelector('.cds--checkbox-wrapper')),
    };
  });
  expect(initialModalLayout.modal.x).toBeGreaterThanOrEqual(0);
  expect(initialModalLayout.modal.right).toBeLessThanOrEqual(initialModalLayout.viewport.width);
  expect(initialModalLayout.modal.bottom).toBeLessThanOrEqual(viewportHeight);
  expect(initialModalLayout.checkbox.x).toBeGreaterThanOrEqual(initialModalLayout.row.right - 64);
  expect(initialModalLayout.page.width).toBeLessThanOrEqual(initialModalLayout.page.clientWidth);
  expect(initialModalLayout.bodyScroll.scrollHeight).toBeGreaterThan(initialModalLayout.bodyScroll.clientHeight);
  expect(initialModalLayout.bodyScroll.overflowY).toBe('auto');
  expect(initialModalLayout.list.overflowY).not.toBe('auto');
  const pageScrollBefore = await page.evaluate(() => document.scrollingElement.scrollTop);
  const scrollArea = dialog.locator('.cds--modal-content');
  await scrollArea.evaluate(node => { node.scrollTop = node.scrollHeight; });
  expect(await scrollArea.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.scrollingElement.scrollTop)).toBe(pageScrollBefore);
  await expect(dialog.getByRole('button', { name: '未回収者をコピー' })).toBeVisible();
  await expect(dialog.locator('.cds--modal-footer').getByRole('button', { name: '閉じる', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '未回収者をコピー' }).click();
  if (isChromium) expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('仮参加者');
  await dialog.getByRole('tab', { name: '未回収' }).click();
  await expect(dialog.getByText('集金不要', { exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: '未回収者をコピー' })).toBeVisible();
  await dialog.getByRole('tab', { name: 'すべて' }).click();
  await expect(dialog.getByText('集金不要', { exact: true }).first()).toBeVisible();
  const collectionCheckbox = dialog.getByRole('checkbox', { name: '検証参加者1の集金チェック' });
  await collectionCheckbox.focus();
  await page.keyboard.press('Space');
  await expect(collectionCheckbox).toBeChecked();
  await page.keyboard.press('Space');
  await expect(collectionCheckbox).not.toBeChecked();
  const trigger = page.getByRole('button', { name: '集金を確認' });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(dialog).toBeVisible();
  await dialog.locator('.cds--modal-footer').getByRole('button', { name: '閉じる', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(pageErrors.get(page)).toEqual([]);
});

test('vehicle settlement keeps expense input above the collapsed cost detail', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: '各車への支払い' })).toBeVisible();
  await expect(page.locator('.settlement-car-list')).toBeVisible();
  const firstCar = page.locator('.settlement-car').first();
  const expenseAction = firstCar.getByRole('button', { name: '費用を入力', exact: true });
  await expect(expenseAction).toBeVisible();
  await expect(expenseAction).toHaveClass(/cds--btn--ghost/);
  await expect(firstCar.locator('.settlement-payment-state')).toHaveCount(0);
  await expect(firstCar.getByRole('button', { name: '支払い済みにする', exact: true })).toHaveCount(0);
  await expect(firstCar.getByRole('button', { name: /割勘 .*・部費/ })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.settlement-check-row')).toHaveCount(0);
  await expect(page.locator('.settlement-status-grid')).toHaveCount(0);
  await expect(page.locator('.settlement-setting-list')).toHaveCount(0);
  await expect(firstCar.getByRole('heading', { name: /仮参加者A車/ })).toBeVisible();
  const editBox = await expenseAction.boundingBox();
  expect(editBox.y).toBeLessThan(844);
  await expect(firstCar.locator('.settlement-car-payment')).toHaveCount(0);
  const firstCarBox = await firstCar.boundingBox();
  expect(firstCarBox.height).toBeLessThan(180);
  await firstCar.getByRole('button', { name: /割勘 .*・部費/ }).click();
  await expect(firstCar.getByText('運転手への支払額', { exact: true })).toHaveCount(0);
  await expect(firstCar.getByText('費用小計', { exact: true })).toHaveCount(0);
});

test('settlement responsive layout fits viewports and captures key states', async ({ page }, testInfo) => {
  const project = testInfo.project.name;
  const widths = project === 'webkit-mobile' || project === 'chromium-mobile'
    ? [390, 430]
    : [768, 1280];
  const height = project === 'chromium-desktop' ? 900 : 844;
  const expectNoHorizontalOverflow = async () => {
    const metrics = await page.evaluate(() => ({
      viewport: innerWidth,
      document: document.documentElement.scrollWidth,
      documentClient: document.documentElement.clientWidth,
      body: document.body.scrollWidth,
      bodyClient: document.body.clientWidth,
    }));
    expect(metrics.document).toBeLessThanOrEqual(metrics.documentClient);
    expect(metrics.body).toBeLessThanOrEqual(metrics.bodyClient);
  };

  for (const width of widths) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => scrollTo(0, 0));
    await expectNoHorizontalOverflow();
    const capture = async state => {
      if (width !== 390 && width !== 1280) return;
      await page.screenshot({ path: testInfo.outputPath(`${width}-${state}.png`) });
    };

    await capture('A-top');
    const firstCar = page.locator('.settlement-car').first();
    const carHeight = (await firstCar.boundingBox()).height;
    expect(carHeight).toBeLessThan(180);
    await firstCar.screenshot({ path: testInfo.outputPath(`${width}-B-vehicle.png`) });
    await firstCar.getByRole('button', { name: /割勘 .*・部費/ }).click();
    await expect(firstCar.getByText('費用小計', { exact: true })).toHaveCount(0);
    await expect(firstCar.getByText('運転手への支払額', { exact: true })).toHaveCount(0);
    await expect(firstCar.getByText('集金分差し引き', { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow();
    await firstCar.screenshot({ path: testInfo.outputPath(`${width}-C-breakdown.png`) });
    await firstCar.getByRole('button', { name: /割勘 .*・部費/ }).click();

    const trigger = page.getByRole('button', { name: '集金を確認' });
    await expect(trigger).toHaveCSS('block-size', '32px');
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: '集金を確認' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('tab', { name: 'すべて' }).click();
    await expect(dialog.getByRole('checkbox')).toHaveCount(21);
    await expect(dialog.getByText('支払額から差し引き済み', { exact: true }).first()).toBeVisible();
    await capture('D-collection');
    const modalRect = await dialog.evaluate(node => {
      const { x, right, width: contentWidth, top, bottom, height: contentHeight } = node.getBoundingClientRect();
      return { x, right, width: contentWidth, top, bottom, height: contentHeight };
    });
    expect(modalRect.x).toBeGreaterThanOrEqual(0);
    expect(modalRect.right).toBeLessThanOrEqual(width);
    expect(modalRect.width).toBeGreaterThanOrEqual(320);
    expect(modalRect.top).toBeGreaterThanOrEqual(0);
    expect(modalRect.bottom).toBeLessThanOrEqual(height);
    const participantContent = await dialog.evaluate(node => {
      const body = node.querySelector('.cds--modal-content');
      const list = node.querySelector('.settlement-collection-list');
      const labels = [...node.querySelectorAll('.settlement-collection-row .cds--contained-list-item__content span, .settlement-collection-row .cds--contained-list-item__content strong')];
      const checkbox = node.querySelector('.settlement-collection-row:not(.excluded) .cds--checkbox-wrapper').getBoundingClientRect();
      const row = node.querySelector('.settlement-collection-row:not(.excluded)').getBoundingClientRect();
      return { labels: labels.map(element => ({ left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right })), checkbox: { left: checkbox.left, right: checkbox.right }, row: { left: row.left, right: row.right }, body: { clientHeight: body.clientHeight, scrollHeight: body.scrollHeight, overflowY: getComputedStyle(body).overflowY }, list: { clientHeight: list.clientHeight, scrollHeight: list.scrollHeight, overflowY: getComputedStyle(list).overflowY } };
    });
    expect(participantContent.labels.every(label => label.left >= modalRect.x && label.right <= modalRect.right)).toBe(true);
    expect(participantContent.checkbox.left).toBeGreaterThanOrEqual(participantContent.row.right - 64);
    expect(participantContent.body.scrollHeight).toBeGreaterThan(participantContent.body.clientHeight);
    expect(participantContent.body.overflowY).toBe('auto');
    expect(participantContent.list.overflowY).not.toBe('auto');
    await expectNoHorizontalOverflow();
    const scrollArea = dialog.locator('.cds--modal-content');
    const scrollMetrics = await scrollArea.evaluate(node => ({ top: node.scrollTop, height: node.clientHeight, scrollHeight: node.scrollHeight }));
    expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.height);
    const pageTop = await page.evaluate(() => document.scrollingElement.scrollTop);
    await scrollArea.evaluate(node => { node.scrollTop = node.scrollHeight; });
    expect(await scrollArea.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.scrollingElement.scrollTop)).toBe(pageTop);
    await dialog.getByRole('checkbox').first().focus();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await expectNoHorizontalOverflow();

    await page.evaluate(() => scrollTo(0, document.scrollingElement.scrollHeight));
    await capture('E-bottom');
    await expect(page.getByRole('heading', { name: 'メモ', exact: true })).toBeVisible();
    await expect(page.locator('#settlement-memo-editor')).toHaveCount(0);
    await page.getByRole('button', { name: 'メモを追加' }).click();
    await expect(page.locator('#settlement-memo-editor')).toHaveAttribute('rows', '3');
    await page.getByRole('button', { name: 'キャンセル' }).click();
    await expectNoHorizontalOverflow();
  }
});

test('settlement progress wraps as groups and cost details avoid redundant type labels', async ({ page }) => {
  await expect(page.locator('.settlement-payment-summary')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '各車への支払い' })).toBeVisible();
  await expect(page.locator('.settlement-car .settlement-payment-state')).toHaveCount(0);
  await expect(page.locator('.settlement-car').first().getByRole('button', { name: '費用を入力', exact: true })).toBeVisible();

  const collectionSummary = page.locator('.settlement-collection-summary');
  await expect(collectionSummary.locator(':scope > span')).toHaveCount(2);
  await expect(collectionSummary.locator(':scope > span').nth(1)).toContainText('残り');
  await expect(collectionSummary.locator(':scope > span').nth(1)).toHaveCSS('white-space', 'nowrap');

  const firstCar = page.locator('.settlement-car').first();
  await firstCar.getByRole('button', { name: /割勘 .*・部費/ }).click();
  const split = firstCar.locator('.settlement-cost-group').nth(0);
  const club = firstCar.locator('.settlement-cost-group').nth(1);
  await expect(split.getByText('高速代', { exact: true })).toBeVisible();
  await expect(split.getByText('高速代（割勘）', { exact: true })).toHaveCount(0);
  await expect(split.getByText('割引（割勘から差し引き）', { exact: true })).toBeVisible();
  await expect(club.getByText('駐車代', { exact: true })).toBeVisible();
  await expect(club.getByText('駐車代（部費）', { exact: true })).toHaveCount(0);
  await expect(split.getByRole('heading', { name: '割勘' })).toBeVisible();
  await expect(club.getByRole('heading', { name: '部費' })).toBeVisible();
  await expect(firstCar.getByText('運転手への支払額', { exact: true })).toHaveCount(0);
  await expect(firstCar.locator('.settlement-cost-grand-total')).toHaveCount(0);
});

test('driver names appear only when a car has multiple drivers', async ({ page }) => {
  const carA = page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) });
  await expect(carA.getByText(/^運転手：/)).toHaveCount(0);
  await page.getByRole('tab', { name: '車割', exact: true }).click();
  const allocationCarA = page.getByRole('region', { name: '仮参加者A車', exact: true });
  await allocationCarA.getByRole('button', { name: '仮参加者Bの操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '運転手にする', exact: true }).click();
  await page.getByRole('tab', { name: '精算', exact: true }).click();
  await expect(carA.getByText('運転手：仮参加者A、仮参加者B（車単位で一括支払い）', { exact: true })).toBeVisible();
  expect(pageErrors.get(page)).toEqual([]);
});

test('car expense editor uses a compact Carbon list and focused mobile editing surface', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 703 });
  await openCarExpenseEditor(page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) }));
  const dialog = page.getByRole('dialog', { name: '仮参加者A車' });
  await expect(dialog.getByRole('heading', { name: '費用を編集' })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: '費用一覧' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: '費用を保存' })).toBeVisible();
  await expect(dialog.locator('.settlement-cost-editor')).toHaveCount(1);
  await expect(dialog.getByRole('list', { name: '車両費用' })).toBeVisible();
  await expect(dialog.locator('.settlement-cost-editor .settlement-cost-list-item')).toHaveCount(4);
  const parkingRow = dialog.getByRole('listitem').filter({ hasText: '駐車代' });
  await expect(parkingRow.getByRole('button', { name: '駐車代を編集' })).toBeVisible();
  await expect(dialog.getByText('自動計算')).toHaveCount(0);
  await expect(dialog.getByRole('heading', { name: '企画内の費用' })).toBeVisible();
  await expect(dialog.locator('.settlement-extra-candidates')).toBeVisible();
  const modalContentMetrics = await dialog.locator('.cds--modal-content').evaluate(node => ({ client: node.clientWidth, scroll: node.scrollWidth }));
  expect(modalContentMetrics.scroll).toBeLessThanOrEqual(modalContentMetrics.client + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await dialog.getByRole('button', { name: '閉じる' }).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: '費用を保存' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: '閉じる' })).toBeFocused();
  const candidateAction = dialog.locator('.settlement-extra-candidates').getByRole('button');
  await expect(candidateAction.first()).toHaveAccessibleName(/追加/);
  const candidatesBeforeAdd = await candidateAction.count();
  expect(candidatesBeforeAdd).toBeGreaterThan(0);

  await candidateAction.first().click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: '費用を追加', exact: true })).toHaveCount(0);
  await expect(dialog.locator('.settlement-cost-editor .settlement-cost-list-item')).toHaveCount(5);
  await expect(candidateAction).toHaveCount(candidatesBeforeAdd - 1);
  await expect(page.getByText(/を追加しました。保存すると反映されます。/)).toBeVisible();
  await dialog.getByRole('button', { name: '新しい費用を追加', exact: true }).click();
  const newExpenseForm = dialog.locator('.settlement-cost-editor-form');
  await expect(newExpenseForm).toBeVisible();
  await expect(newExpenseForm.getByLabel('名目')).toBeFocused();
  await dialog.getByRole('button', { name: '戻る' }).click();
  await expect(dialog.locator('.settlement-cost-editor')).toBeVisible();

  await expect(parkingRow.getByRole('button', { name: '駐車代を編集' })).toBeVisible();
  await expect(parkingRow.getByRole('button', { name: '駐車代の操作' })).toHaveCount(0);
  await parkingRow.getByRole('button', { name: '駐車代を編集' }).click();
  const editor = dialog.locator('.settlement-cost-editor-form');
  await expect(editor.getByLabel('名目')).toHaveValue('駐車代');
  await expect(editor.getByRole('radio', { name: '割勘' })).toBeVisible();
  await expect(editor.getByRole('checkbox', { name: /^(?:部費|割勘)の費用から差し引く$/ })).toBeVisible();
  const editorLocation = await editor.evaluate(node => ({
    heading: node.querySelector('h3')?.textContent,
    belongsToOneList: !!node.closest('.settlement-cost-editor'),
  }));
  expect(editorLocation.heading).toBeFalsy();
  expect(editorLocation.belongsToOneList).toBe(false);
  await expect(dialog.getByRole('button', { name: '変更を反映' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '戻る' })).toBeVisible();
  await expect(editor.getByRole('textbox', { name: /金額（円）/ })).toHaveCSS('text-align', 'right');
  await expect(editor.getByLabel('名目')).toBeFocused();
  const titleGap = await dialog.evaluate(node => {
    const header = node.querySelector('.cds--modal-header');
    const firstRow = node.querySelector('.cds--contained-list-item');
    return firstRow.getBoundingClientRect().top - header.getBoundingClientRect().bottom;
  });
  expect(titleGap).toBeLessThanOrEqual(24);

  const content = dialog.locator('.cds--modal-content');
  const contentSize = await content.evaluate(node => ({ scrollHeight: node.scrollHeight, clientHeight: node.clientHeight }));
  if (contentSize.scrollHeight > contentSize.clientHeight) {
    await content.hover();
    await page.mouse.wheel(0, 480);
    await expect.poll(() => content.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  }
  const scrollState = await dialog.evaluate(node => ({
    containerTop: node.scrollTop,
    containerScrollHeight: node.scrollHeight,
    containerClientHeight: node.clientHeight,
    headerScrollHeight: node.querySelector('.cds--modal-header').scrollHeight,
    headerClientHeight: node.querySelector('.cds--modal-header').clientHeight,
    headerOverflowY: getComputedStyle(node.querySelector('.cds--modal-header')).overflowY,
    footerBottom: node.querySelector('.cds--modal-footer').getBoundingClientRect().bottom,
    viewportHeight: window.innerHeight,
  }));
  expect(scrollState.containerTop).toBe(0);
  expect(scrollState.containerScrollHeight).toBeLessThanOrEqual(scrollState.containerClientHeight + 1);
  expect(scrollState.headerScrollHeight).toBeLessThanOrEqual(scrollState.headerClientHeight + 1);
  expect(scrollState.headerOverflowY).toBe('visible');
  expect(scrollState.footerBottom).toBeLessThanOrEqual(scrollState.viewportHeight);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(pageErrors.get(page)).toEqual([]);
});

test('car expense candidates omit costs already on the current car', async ({ page }) => {
  const car = page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) });
  await openCarExpenseEditor(car);
  const dialog = page.getByRole('dialog', { name: '仮参加者A車' });
  const candidates = dialog.locator('.settlement-extra-candidates');
  await expect(candidates.getByText('駐車場', { exact: true })).toHaveCount(0);
  await expect(candidates.getByRole('button', { name: '追加' })).toHaveCount(1);
});

test('vehicle expenses use an explicit list and separate focused Carbon form on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 703 });
  await openCarExpenseEditor(page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) }));
  const dialog = page.getByRole('dialog', { name: '仮参加者A車' });
  const list = dialog.locator('.settlement-cost-editor');
  await expect(list).toBeVisible();
  const parkingRow = list.getByRole('listitem').filter({ hasText: '駐車代' });
  const editButton = parkingRow.getByRole('button', { name: '駐車代を編集' });
  await expect(editButton).toBeVisible();
  const expectActionButtonsNotToOverlapAmounts = async () => {
    const overlaps = await list.locator('.settlement-cost-list-item').evaluateAll(rows => rows.flatMap(row => {
      const amount = row.querySelector('.settlement-cost-summary__amount')?.getBoundingClientRect();
      const buttons = [...row.querySelectorAll('.cds--contained-list-item__action button')];
      return buttons.map(button => {
        const action = button.getBoundingClientRect();
        return Boolean(amount && action.left < amount.right && action.right > amount.left && action.top < amount.bottom && action.bottom > amount.top);
      });
    }));
    expect(overlaps).toEqual(expect.arrayContaining([false]));
    expect(overlaps.every(overlap => !overlap)).toBe(true);
  };
  await expectActionButtonsNotToOverlapAmounts();
  await page.setViewportSize({ width: 565, height: 703 });
  await expectActionButtonsNotToOverlapAmounts();
  await page.setViewportSize({ width: 390, height: 703 });

  await editButton.click();
  const form = dialog.locator('.settlement-cost-editor-form');
  await expect(form).toBeVisible();
  await expect(list).toHaveCount(0);
  await expect(dialog.getByRole('heading', { name: '駐車代を編集' })).toBeVisible();
  await expect(form.getByRole('heading')).toHaveCount(0);
  await expect(form.getByLabel('名目')).toHaveValue('駐車代');
  await expect(form.getByRole('radio', { name: '割勘' })).toBeVisible();
  await expect(form.getByRole('checkbox', { name: /^(?:部費|割勘)の費用から差し引く$/ })).toBeVisible();
  const deleteButton = form.getByRole('button', { name: '駐車代を削除' });
  await expect(deleteButton).toHaveClass(/cds--btn--danger--ghost/);
  await expect(form.getByText('入力した金額をマイナスの費用として扱います。')).toBeVisible();
  await expect(form.locator('.settlement-cost-type-control')).toHaveCSS('grid-template-columns', /^(\d+px)$/);

  await dialog.getByRole('button', { name: '戻る' }).click();
  await expect(list).toBeVisible();
  await expect(editButton).toBeFocused();
  await expect(parkingRow.getByRole('button', { name: '駐車代の操作' })).toHaveCount(0);
  await dialog.getByRole('button', { name: '新しい費用を追加', exact: true }).click();
  await expect(form).toBeVisible();
  await expect(dialog.getByRole('heading', { name: '費用を追加' })).toBeVisible();
  await expect(form.getByLabel('名目')).toBeFocused();
  await expect(dialog.getByRole('button', { name: '費用を追加', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '戻る' }).click();
  await expect(list.getByText('駐車代', { exact: true })).toBeVisible();
  await parkingRow.getByRole('button', { name: '駐車代を編集' }).click();
  await form.getByRole('button', { name: '駐車代を削除' }).click();
  await expect(list.getByText('駐車代', { exact: true })).toHaveCount(0);
  const undo = dialog.getByRole('button', { name: '元に戻す' });
  await expect(undo).toBeVisible();
  await undo.click();
  await expect(list.getByText('駐車代', { exact: true })).toBeVisible();

  await parkingRow.getByRole('button', { name: '駐車代を編集' }).click();
  await form.getByRole('button', { name: '駐車代を削除' }).click();
  await expect(list.getByText('駐車代', { exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'キャンセル' }).click();
  await expect(dialog).toHaveCount(0);

  await openCarExpenseEditor(page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) }));
  const reopenedDialog = page.getByRole('dialog', { name: '仮参加者A車' });
  const reopenedList = reopenedDialog.locator('.settlement-cost-editor');
  await expect(reopenedList.getByText('駐車代', { exact: true })).toBeVisible();
  await reopenedList.getByRole('listitem').filter({ hasText: '駐車代' }).getByRole('button', { name: '駐車代を編集' }).click();
  await reopenedDialog.getByRole('button', { name: '駐車代を削除' }).click();
  await reopenedDialog.getByRole('button', { name: '費用を保存' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await page.getByRole('tab', { name: '精算', exact: true }).click();
  await openCarExpenseEditor(page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) }));
  await expect(page.getByRole('dialog', { name: '仮参加者A車' }).getByText('駐車代', { exact: true })).toHaveCount(0);
});

test('movement settings body scrolls within a short mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 703 });
  await openCarExpenseEditor(page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) }));
  const dialog = page.getByRole('dialog', { name: '仮参加者A車' });
  await dialog.getByRole('button', { name: 'ガソリン代の計算条件を編集' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(dialog.getByRole('heading', { name: 'ガソリン代を設定' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'ガソリン代を適用' })).toBeVisible();
  const burdenGroup = dialog.getByRole('group', { name: '移動料金の負担区分' });
  await expect(burdenGroup).toBeVisible();
  await expect(burdenGroup.getByRole('radio', { name: '割勘' })).toBeVisible();
  await expect(burdenGroup.getByRole('radio', { name: '部費' })).toBeVisible();
  const movementLabels = await dialog.locator('.settlement-movement-form legend, .settlement-movement-section-title, .settlement-movement-preview span').allTextContents();
  expect(movementLabels).toEqual(['車両種別', '移動料金の計算条件', '移動料金の負担区分', 'ガソリン代の金額']);
  await expect(dialog.locator('#settlement-distance')).toHaveAttribute('inputmode', 'decimal');
  await expect(dialog.locator('#settlement-eco')).toHaveAttribute('inputmode', 'decimal');
  await expect(dialog.locator('#settlement-price')).toHaveAttribute('inputmode', 'decimal');
  const columns = await dialog.locator('.settlement-movement-form .form-grid').evaluate(node => getComputedStyle(node).gridTemplateColumns);
  expect(columns.split(' ').length).toBe(1);
  await expect(dialog.getByRole('heading', { name: '移動料金の計算条件' })).toHaveCSS('font-size', '14px');
  const fieldStyle = await dialog.locator('.settlement-movement-form .cds--text-input').first().evaluate(node => ({
    background: getComputedStyle(node).backgroundColor,
    borderBottomStyle: getComputedStyle(node).borderBottomStyle,
  }));
  expect(fieldStyle.background).not.toBe('rgba(0, 0, 0, 0)');
  expect(fieldStyle.borderBottomStyle).toBe('solid');
  await expect(dialog.getByText('ガソリン代の金額')).toBeVisible();
  await expect(dialog.locator('.settlement-movement-preview')).toContainText('ガソリン代の金額¥1,633');
  await expect(dialog.locator('.settlement-movement-preview small')).toHaveCount(0);
  const routeButton = dialog.getByRole('button', { name: '移動距離計算ツール' });
  const routeButtonLayout = await routeButton.evaluate(node => ({
    width: node.getBoundingClientRect().width,
    parentWidth: node.parentElement.getBoundingClientRect().width,
    styleWidth: getComputedStyle(node).inlineSize,
    isGhost: node.classList.contains('cds--btn--ghost'),
  }));
  expect(routeButtonLayout.width).toBeLessThan(routeButtonLayout.parentWidth);
  expect(routeButtonLayout.isGhost).toBe(true);
  expect(routeButtonLayout.styleWidth).not.toBe('100%');
  const content = dialog.locator('.cds--modal-content');
  const before = await content.evaluate(node => ({ clientHeight: node.clientHeight, scrollHeight: node.scrollHeight, scrollTop: node.scrollTop }));
  expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);
  const horizontalOverflow = await dialog.evaluate(node => ({
    page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    modal: node.scrollWidth - node.clientWidth,
    body: node.querySelector('.cds--modal-content').scrollWidth - node.querySelector('.cds--modal-content').clientWidth,
  }));
  expect(horizontalOverflow.page).toBeLessThanOrEqual(0);
  expect(horizontalOverflow.modal).toBeLessThanOrEqual(1);
  expect(horizontalOverflow.body).toBeLessThanOrEqual(1);
  const headerBefore = await dialog.locator('.cds--modal-header').evaluate(node => node.getBoundingClientRect().toJSON());
  await content.hover();
  await page.mouse.wheel(0, 480);
  await expect.poll(() => content.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  await content.evaluate(node => { node.scrollTop = Math.floor((node.scrollHeight - node.clientHeight) / 2); });
  await expect(page.locator('.settlement-movement-modal')).not.toHaveClass(/settlement-modal-at-bottom/);
  const middleScroll = await content.evaluate(node => ({ top: node.scrollTop, max: node.scrollHeight - node.clientHeight, mask: getComputedStyle(node).maskImage }));
  expect(middleScroll.top).toBeLessThan(middleScroll.max);
  expect(middleScroll.mask).not.toBe('none');
  const headerAfter = await dialog.locator('.cds--modal-header').evaluate(node => node.getBoundingClientRect().toJSON());
  expect(headerAfter.top).toBe(headerBefore.top);
  expect(headerAfter.bottom).toBe(headerBefore.bottom);
  expect(await dialog.locator('.cds--modal-header').evaluate(node => getComputedStyle(node).zIndex)).toBe('1');
  const footerBottom = await dialog.locator('.cds--modal-footer').evaluate(node => node.getBoundingClientRect().bottom);
  expect(footerBottom).toBeLessThanOrEqual(page.viewportSize().height);
  const containerSize = await dialog.evaluate(node => ({ scrollHeight: node.scrollHeight, clientHeight: node.clientHeight }));
  expect(containerSize.scrollHeight).toBeLessThanOrEqual(containerSize.clientHeight + 1);
  await content.evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect.poll(() => content.evaluate(node => node.scrollTop + node.clientHeight >= node.scrollHeight - 2)).toBe(true);
  await expect(page.locator('.settlement-movement-modal')).toHaveClass(/settlement-modal-at-bottom/);
  await expect.poll(() => content.evaluate(node => getComputedStyle(node).maskImage)).toBe('none');
  await expect(dialog.locator('.settlement-movement-preview')).toHaveCSS('opacity', '1');
  expect(pageErrors.get(page)).toEqual([]);
});

test('car expense editor fits a desktop viewport without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openCarExpenseEditor(page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) }));
  const dialog = page.getByRole('dialog', { name: '仮参加者A車' });
  await expect(dialog.getByRole('heading', { name: '費用を編集' })).toBeVisible();
  await expect(dialog.locator('.settlement-cost-editor')).toBeVisible();
  await expect(dialog.getByRole('heading', { name: '企画内の費用' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '費用を保存' })).toBeVisible();
  const dimensions = await dialog.evaluate(node => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    modalClient: node.clientWidth,
    modalScroll: node.scrollWidth,
    contentClient: node.querySelector('.cds--modal-content').clientWidth,
    contentScroll: node.querySelector('.cds--modal-content').scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.modalScroll).toBeLessThanOrEqual(dimensions.modalClient + 1);
  expect(dimensions.contentScroll).toBeLessThanOrEqual(dimensions.contentClient + 1);
  expect(pageErrors.get(page)).toEqual([]);
});

test('人数だけで精算するdraft survives save and reload', async ({ page }) => {
  await page.getByRole('button', { name: '精算設定' }).click();
  const modal = page.getByRole('dialog', { name: '精算設定を編集' });
  await modal.getByText('人数だけで精算', { exact: true }).click();
  await modal.getByLabel('運転手の人数').fill('2');
  await modal.getByLabel('同乗者の人数').fill('4');
  await modal.getByLabel('運転手1の名前').fill('第一運転手');
  await modal.getByLabel('運転手2の名前').fill('第二運転手');
  await modal.getByRole('button', { name: '次へ' }).click();
  await modal.getByRole('button', { name: '次へ' }).click();
  await modal.getByRole('button', { name: '保存' }).click();
  await expect(page.getByRole('heading', { name: '第一運転手車' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '第二運転手車' })).toBeVisible();
  await page.reload();
  await page.getByRole('tab', { name: '精算', exact: true }).click();
  await page.getByRole('button', { name: '精算設定' }).click();
  const reloadedSettings = page.getByRole('dialog', { name: '精算設定を編集' });
  await expect(reloadedSettings.getByLabel('運転手の人数')).toHaveValue('2');
  await page.getByRole('button', { name: 'キャンセル' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(pageErrors.get(page)).toEqual([]);
});
test('vehicle settlement presents expense and breakdown with an accessible Carbon accordion', async ({ page }) => {
  const car = page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者D車/ }) });
  const settings = page.getByRole('button', { name: '精算設定を編集' });
  await expect(settings).toHaveClass(/cds--btn--ghost/);
  await expect(car.locator('.settlement-car-payment')).toHaveCount(0);
  await expect(car.locator('.settlement-car-menu')).toHaveCount(0);
  await expect(car.getByText('未払い', { exact: true })).toHaveCount(0);
  await expect(car.getByRole('button', { name: '支払い済みにする', exact: true })).toHaveCount(0);
  await expect(car.getByRole('button', { name: '費用を入力', exact: true })).toBeVisible();

  const articleSeparators = await page.locator('.settlement-car').evaluateAll(elements => elements.map(element => ({
    top: getComputedStyle(element).borderBlockStartStyle,
    bottom: getComputedStyle(element).borderBlockEndStyle,
  })));
  expect(articleSeparators[0]).toEqual({ top: 'none', bottom: 'solid' });
  expect(articleSeparators.at(-1).bottom).toBe('none');
  await expect(car.locator('.cds--accordion__item')).toHaveCSS('border-block-start-style', 'none');
  await expect(car.locator('.cds--accordion__item')).toHaveCSS('border-block-end-style', 'none');

  const disclosure = car.getByRole('button', { name: /割勘 .*・部費/ });
  await expect(disclosure).toHaveAccessibleName('割勘 ¥2,200・部費 ¥-100');
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
  await expect(car.locator('.settlement-cost-list')).not.toBeVisible();
  await disclosure.focus();
  await page.keyboard.press('Enter');
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Space');
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
  await disclosure.click();
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
  await expect(car.locator('.settlement-cost-group h3')).toHaveText(['割勘', '部費']);
  await expect(car.getByText('費用小計', { exact: true })).toHaveCount(0);
  await expect(car.locator('.settlement-car-breakdown').getByText('支払総額', { exact: true })).toHaveCount(0);
  await expect(car.getByText('運転手への支払額', { exact: true })).toHaveCount(0);
  await expect(car.getByText('部費の支払額', { exact: true })).toHaveCount(0);
  await expect(car.getByText('端数処理', { exact: true })).toBeVisible();
  await expect(car.getByText('集金分差し引き', { exact: true })).toBeVisible();
  await expect(car.locator('.settlement-cost-grand-total')).toHaveCount(0);

  await openCarExpenseEditor(car);
  const editDialog = page.getByRole('dialog');
  await expect(editDialog).toBeVisible();
  await editDialog.getByRole('button', { name: '閉じる' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(pageErrors.get(page)).toEqual([]);
});

test('settlement rows wrap long car names and format zero amount', async ({ page }) => {
  const longCar = page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /とても長い確認用のレンタカー車名/ }) });
  await expect(longCar.locator('.settlement-car-payment')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const tile = await longCar.boundingBox();
  const viewportWidth = await page.evaluate(() => innerWidth);
  expect(tile.x + tile.width).toBeLessThanOrEqual(viewportWidth);
  expect(await longCar.getByRole('heading').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(longCar.getByRole('button', { name: '費用を入力', exact: true })).toBeVisible();
  const breakdown = longCar.getByRole('button', { name: '割勘 ¥0・部費 ¥0' });
  await expect(breakdown).toBeVisible();
  await breakdown.click();
  await expect(longCar.locator('.settlement-cost-group h3')).toHaveText(['割勘', '部費']);
  await expect(longCar.getByText('対象なし', { exact: true })).toHaveCount(2);
});

test('settlement memo stays summarized until lightweight inline editing is opened', async ({ page }) => {
  const memoCard = page.locator('.settlement-memo-card');
  await expect(memoCard.getByText('メモなし', { exact: true })).toBeVisible();
  await expect(memoCard.locator('textarea')).toHaveCount(0);
  await memoCard.getByRole('button', { name: 'メモを追加' }).click();
  const textarea = memoCard.getByRole('textbox', { name: 'メモ' });
  await textarea.fill('下書き');
  await memoCard.getByRole('button', { name: 'キャンセル' }).click();
  await expect(memoCard.getByText('メモなし', { exact: true })).toBeVisible();
  await memoCard.getByRole('button', { name: 'メモを追加' }).click();
  await memoCard.getByRole('textbox', { name: 'メモ' }).fill('高速料金は武内さんが立替済み。');
  await memoCard.getByRole('button', { name: '保存' }).click();
  await expect(memoCard.getByText('高速料金は武内さんが立替済み。', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('tab', { name: '精算', exact: true }).click();
  await expect(page.locator('.settlement-memo-card').getByText('高速料金は武内さんが立替済み。', { exact: true })).toBeVisible();
  await expect(pageErrors.get(page)).toEqual([]);
});

test('vehicle rows omit driver payment recording and right-align a ghost expense action', async ({ page }) => {
  const car = page.locator('.settlement-car').first();
  await expect(car.getByText('支払い済み', { exact: true })).toHaveCount(0);
  await expect(car.getByText('未払い', { exact: true })).toHaveCount(0);
  await expect(car.getByRole('button', { name: '支払い済みにする', exact: true })).toHaveCount(0);
  await expect(car.getByRole('button', { name: /その他の操作/ })).toHaveCount(0);
  const expense = car.getByRole('button', { name: '費用を入力', exact: true });
  await expect(expense).toHaveClass(/cds--btn--ghost/);
  await expect(expense.locator('.cds--btn__icon')).toHaveCount(0);
  const alignment = await expense.evaluate(button => ({ button: button.getBoundingClientRect().toJSON(), actions: button.parentElement.getBoundingClientRect().toJSON() }));
  expect(Math.abs(alignment.button.right - alignment.actions.right)).toBeLessThanOrEqual(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expense.click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('settlement WebKit text and control size audit', async ({ page }, testInfo) => {
  async function capture(label, screenshot) {
    const sizes = await page.evaluate(() => {
      const visible = element => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const modal = [...document.querySelectorAll('.cds--modal.is-visible')].at(-1);
      const root = modal || document.querySelector('.settlement-page');
      const buttons = [...root.querySelectorAll('button')].filter(visible).map(button => {
        const rect = button.getBoundingClientRect();
        const label = (button.innerText || button.getAttribute('aria-label') || button.title || '').trim().replace(/\s+/g, ' ');
        return { label, height: Math.round(rect.height), width: Math.round(rect.width), fontSize: Number.parseFloat(getComputedStyle(button).fontSize), iconOnly: !button.innerText.trim() && !!button.querySelector('svg'), nonInteractive: button.classList.contains('cds--progress-step-button--unclickable') };
      });
      const textNodes = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const text = node.textContent.trim().replace(/\s+/g, ' ');
        if (!text || !visible(node.parentElement)) continue;
        textNodes.push({ text: text.slice(0, 55), tag: node.parentElement.tagName.toLowerCase(), fontSize: Number.parseFloat(getComputedStyle(node.parentElement).fontSize) });
      }
      const iconTargets = buttons.filter(button => button.iconOnly).map(({ label, height, width }) => ({ label, height, width }));
      const menuItems = [...document.querySelectorAll('.cds--overflow-menu-options__btn')].filter(visible).map(item => ({
        label: (item.innerText || item.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' '),
        height: Math.round(item.getBoundingClientRect().height),
        fontSize: Number.parseFloat(getComputedStyle(item).fontSize),
      }));
      return {
        buttonCount: buttons.length,
        textCount: textNodes.length,
        smallestButtonText: buttons.filter(button => button.label && !button.iconOnly && button.fontSize < 14),
        smallestButtons: buttons.filter(button => !button.nonInteractive && button.height < 32),
        iconTargetsBelow44: iconTargets.filter(target => target.height < 44 || target.width < 44),
        menuItems,
        smallestText: textNodes.filter(node => node.fontSize < 12).sort((a, b) => a.fontSize - b.fontSize).slice(0, 12),
        inputs: [...root.querySelectorAll('input,textarea')].filter(visible).map(input => ({ id: input.id, fontSize: Number.parseFloat(getComputedStyle(input).fontSize), height: Math.round(input.getBoundingClientRect().height) })),
      };
    });
    console.log(`SETTLEMENT_SIZE_AUDIT ${testInfo.project.name} ${label} ${JSON.stringify(sizes)}`);
    expect(sizes.smallestButtonText).toEqual([]);
    expect(sizes.smallestButtons).toEqual([]);
    expect(sizes.smallestText).toEqual([]);
    if (testInfo.project.name === 'webkit-mobile') {
      expect(sizes.iconTargetsBelow44).toEqual([]);
      if (sizes.menuItems.length) {
        expect(sizes.menuItems.every(item => item.height >= 47 && item.fontSize >= 16)).toBe(true);
      }
      expect(sizes.inputs.filter(input => input.height > 2).every(input => input.fontSize >= 16)).toBe(true);
    }
    if (screenshot) await page.screenshot({ path: testInfo.outputPath(screenshot), animations: 'disabled' });
    return sizes;
  }

  await capture('overview', 'settlement-overview.png');
  await page.getByRole('button', { name: '集金を確認' }).click();
  await capture('collection', 'settlement-collection.png');
  await page.locator('.settlement-collection-modal .cds--modal-footer button').last().click();

  await openCarExpenseEditor(page.locator('.settlement-car').first());
  const dialog = page.getByRole('dialog', { name: '仮参加者A車' });
  await capture('expense-list', 'settlement-expense-list.png');
  await dialog.getByRole('button', { name: 'ガソリン代の計算条件を編集' }).click();
  await capture('expense-edit-action');
  await capture('movement-settings', 'settlement-movement.png');
  await dialog.getByRole('button', { name: '移動距離計算ツール' }).click();
  await expect(dialog.locator('.route-stop-actions button')).toHaveCount(5);
  await capture('route-planner', 'settlement-route.png');
  await dialog.getByRole('button', { name: '戻る' }).click();
  await dialog.getByRole('button', { name: '戻る' }).click();
  await dialog.getByRole('button', { name: '駐車代を編集' }).click();
  await capture('expense-edit');
  await dialog.getByRole('button', { name: '戻る' }).click();
  await dialog.getByRole('button', { name: '新しい費用を追加', exact: true }).click();
  await capture('expense-fields', 'settlement-extra.png');
  await dialog.getByRole('button', { name: '戻る' }).click();
  await dialog.getByRole('button', { name: 'キャンセル' }).click();

  await page.getByRole('button', { name: '精算設定を編集' }).click();
  const settings = page.getByRole('dialog', { name: '精算設定を編集' });
  await capture('settings-method', 'settlement-settings.png');
  await settings.getByRole('button', { name: '次へ' }).click();
  await capture('settings-reward');
  await settings.getByRole('button', { name: '次へ' }).click();
  await capture('settings-collection-rules');
  await settings.getByRole('button', { name: 'キャンセル' }).click();

  await page.getByRole('button', { name: 'メモを追加' }).click();
  await capture('memo-editor');
  await page.getByRole('button', { name: 'キャンセル' }).click();
});
