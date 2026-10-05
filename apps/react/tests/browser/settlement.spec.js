import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { navigateToProjectSection } from './project-navigation.js';
import { editFee } from './vehicle-cost-fixture.js';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/legacy-v4.json', import.meta.url)));
const pageErrors = new WeakMap();
const browserConsoleIssues = new WeakMap();

async function openCarExpenseEditor(car) {
  await car.getByRole('button', { name: /費用を入力$/ }).click();
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
    initialFixture.settlement.cars[longName] = { ...initialFixture.settlement.cars[oldName], dist: '0', extras: [] };
    delete initialFixture.settlement.cars[oldName];
    if (Object.hasOwn(initialFixture.settlement.driverPaid, oldName)) {
      initialFixture.settlement.driverPaid[longName] = initialFixture.settlement.driverPaid[oldName];
      delete initialFixture.settlement.driverPaid[oldName];
    }
    initialFixture.settlement.driverReward = '0';
    initialFixture.settlement.driverCollectionOffset = false;
  }
  if (testInfo.title === 'collection uses a Carbon modal with one scrolling body, filters, copy, and excluded labels' || testInfo.title.startsWith('settlement responsive layout')) {
    initialFixture.settlement.organizerFree = true;
    initialFixture.cars[0].members.push(...Array.from({ length: 18 }, (_, index) => ({ name: `検証参加者${index + 1}`, grade: 1 })));
  }
  await page.addInitScript(({ key, value }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value)); }, {
    key: `sanpo-react:v1:${roomId}:room`, value: initialFixture,
  });
  await page.goto(`/?room=${roomId}`);
  await navigateToProjectSection(page, '精算');
});

test.afterEach(async ({ page }) => {
  expect(browserConsoleIssues.get(page)).toEqual([]);
});

test('settings cancel/save, signed extras, collection state and reload', async ({ page }) => {
  await expect(page.getByRole('heading', { name: '各車への支払い' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '集金チェック' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '精算状況' })).toHaveCount(0);
  await expect(page.getByText('精算モード', { exact: true })).toHaveCount(0);

  await page.getByRole('link', { name: '精算ルール', exact: true }).click();
  let settings = page.getByRole('form', { name: '精算ルール', exact: true });
  await settings.getByText('10円単位', { exact: true }).click();
  await page.getByRole('button', { name: 'キャンセル' }).click();
  await page.getByRole('link', { name: '精算ルール', exact: true }).click();
  settings = page.getByRole('form', { name: '精算ルール', exact: true });
  await expect(settings.getByRole('radio', { name: '100円単位' })).toBeChecked();
  await page.getByRole('button', { name: 'キャンセル' }).click();

  await page.getByRole('link', { name: '精算ルール', exact: true }).click();
  settings = page.getByRole('form', { name: '精算ルール', exact: true });
  await expect(settings.getByRole('radio', { name: '車への支払額から差し引く' })).toBeVisible();
  await page.getByRole('button', { name: 'キャンセル' }).click();

  await page.getByRole('link', { name: '精算ルール', exact: true }).click();
  settings = page.getByRole('form', { name: '精算ルール', exact: true });
  await settings.getByText('10円単位', { exact: true }).click();
  await settings.getByLabel('1台あたりの協力代（円）').fill('700');
  await settings.getByRole('button', { name: '精算ルールを保存' }).click();
  await page.getByRole('link', { name: '精算ルール', exact: true }).click();
  settings = page.getByRole('form', { name: '精算ルール', exact: true });
  await expect(settings.getByRole('radio', { name: '10円単位' })).toBeChecked();
  await page.getByRole('button', { name: 'キャンセル' }).click();

  await openCarExpenseEditor(page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) }));
  await page.getByRole('button', { name: '費用を追加', exact:true }).click();
  const name=page.getByRole('textbox',{name:'費用名',exact:true});
  await name.dispatchEvent('compositionstart');
  await name.fill('にほんごへんかんちゅう');
  await name.press('Enter');
  await expect(page.getByRole('form')).toBeVisible();
  await name.dispatchEvent('compositionend',{data:'日本語変換中の返金'});
  await name.fill('日本語変換中の返金');
  await page.getByRole('textbox',{name:'金額（円）',exact:true}).fill('300');
  await page.getByRole('group',{name:'負担区分',exact:true}).getByText('部費',{exact:true}).click();
  await page.getByText('部費の費用から差し引く',{exact:true}).click();
  await page.getByRole('button',{name:'車両費用を保存',exact:true}).click();
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
  await navigateToProjectSection(page, '精算');
  await page.getByRole('link', { name: '精算ルール', exact: true }).click();
  settings = page.getByRole('form', { name: '精算ルール', exact: true });
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
  const expenseAction = firstCar.getByRole('button', { name: /費用を入力$/ });
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
  await expect(page.locator('.settlement-car').first().getByRole('button', { name: /費用を入力$/ })).toBeVisible();

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
  await navigateToProjectSection(page, '車割');
  const allocationCarA = page.getByRole('region', { name: '仮参加者A車', exact: true });
  await page.getByRole('link', { name: '仮参加者A車の詳細', exact: true }).click();
  await allocationCarA.getByRole('button', { name: '仮参加者Bの操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '運転手にする', exact: true }).click();
  await navigateToProjectSection(page, '精算');
  await expect(carA.getByText('運転手：仮参加者A、仮参加者B（車単位で一括支払い）', { exact: true })).toBeVisible();
  expect(pageErrors.get(page)).toEqual([]);
});

test('car fee list preserves reuse deletion standard rows and Japanese raw input', async ({page})=>{
  await page.setViewportSize({width:390,height:703});
  await openCarExpenseEditor(page.locator('.settlement-car').first());
  await expect(page.getByRole('heading',{level:1,name:'仮参加者A車の費用'})).toBeFocused();
  const list=page.getByRole('list',{name:'費目一覧',exact:true});
  await expect(list.getByRole('listitem')).toHaveCount(5);
  const reward=list.getByRole('listitem').filter({hasText:'車出し協力代'});
  await expect(reward.getByRole('link')).toHaveCount(0);
  await expect(reward.getByRole('button')).toHaveCount(0);
  await page.getByRole('combobox',{name:'登録済み費用',exact:true}).selectOption('駐車代');
  await page.getByRole('button',{name:'登録済みから追加',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'費用名',exact:true})).toHaveValue('駐車代');
  await expect(page.getByRole('textbox',{name:'金額（円）',exact:true})).toHaveValue('800');
  await page.getByRole('textbox',{name:'費用名',exact:true}).fill('再利用費用');
  await page.getByRole('link',{name:'費目一覧に戻る',exact:true}).click();
  await page.getByRole('button',{name:'再利用費用の操作',exact:true}).click();
  await page.getByRole('menuitem',{name:'削除',exact:true}).click();
  await page.getByRole('link',{name:'費目一覧に戻る',exact:true}).click();
  await expect(list.getByRole('listitem').filter({hasText:'再利用費用'})).toHaveCount(0);
  await expect(list.getByRole('listitem')).toHaveCount(5);
});

test('mobile list and editor keep amounts separate from actions and preserve edits on Back', async({page})=>{
  await page.setViewportSize({width:390,height:703});
  await openCarExpenseEditor(page.locator('.settlement-car').first());
  const list=page.getByRole('list',{name:'費目一覧',exact:true});
  for(const width of [390,565]){
    await page.setViewportSize({width,height:703});
    const row=list.getByRole('listitem').filter({hasText:'駐車代'});
    const amount=await row.getByText('800円',{exact:true}).boundingBox(), action=await row.getByRole('link',{name:'駐車代を編集'}).boundingBox();
    expect(amount.x+amount.width<=action.x || amount.y+amount.height<=action.y || action.y+action.height<=amount.y).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.getByRole('link',{name:'駐車代を編集',exact:true}).click();
  await expect(list).toHaveCount(0);
  await expect(page.getByRole('form')).toHaveCount(1);
  await page.getByRole('textbox',{name:'金額（円）',exact:true}).fill('900');
  await page.getByRole('link',{name:'費目一覧に戻る',exact:true}).click();
  await page.getByRole('link',{name:'駐車代を編集',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'金額（円）',exact:true})).toHaveValue('900');
  await page.getByRole('button',{name:'キャンセル',exact:true}).click();
});

test('movement page has one document scroll with usable fields and commit actions in short viewport',async({page})=>{
  await page.setViewportSize({width:390,height:600});
  await openCarExpenseEditor(page.locator('.settlement-car').first());
  await editFee(page,'移動条件');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  for(const label of ['走行距離（km）','燃費（km/L）','ガソリン単価（円/L）'])await expect(page.getByRole('textbox',{name:label,exact:true})).toHaveAttribute('inputmode','decimal');
  await expect(page.getByText('186km ÷ 18km/L × 158円/L',{exact:true})).toBeVisible();
  const save=page.getByRole('button',{name:'車両費用を保存',exact:true});
  await save.scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(0);
  const box=await save.boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);expect(box.y+box.height).toBeLessThanOrEqual(600);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'キャンセル',exact:true}).click();
});

test('desktop cost workspace shares one form and scan list without horizontal scroll',async({page})=>{
  await page.setViewportSize({width:1280,height:900});
  await openCarExpenseEditor(page.locator('.settlement-car').first());
  const list=page.getByRole('list',{name:'費目一覧',exact:true}),form=page.getByRole('form');
  await expect(list).toBeVisible();await expect(form).toHaveCount(1);await expect(page.getByRole('main')).toHaveCount(1);await expect(page.getByRole('heading',{level:1})).toHaveCount(1);
  const a=await list.boundingBox(),b=await form.boundingBox();expect(a.x+a.width).toBeLessThanOrEqual(b.x);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('人数だけで精算するdraft survives save and reload', async ({ page }) => {
  await page.getByRole('link', { name: '精算ルール', exact: true }).click();
  const modal = page.getByRole('form', { name: '精算ルール', exact: true });
  await modal.getByText('人数だけで精算', { exact: true }).click();
  await modal.getByLabel('運転手の人数').fill('2');
  await modal.getByLabel('同乗者の人数').fill('4');
  await modal.getByLabel('運転手1の名前').fill('第一運転手');
  await modal.getByLabel('運転手2の名前').fill('第二運転手');
  await modal.getByRole('button', { name: '精算ルールを保存' }).click();
  await expect(page.getByRole('heading', { name: '第一運転手車' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '第二運転手車' })).toBeVisible();
  await page.reload();
  await navigateToProjectSection(page, '精算');
  await page.getByRole('link', { name: '精算ルール', exact: true }).click();
  const reloadedSettings = page.getByRole('form', { name: '精算ルール', exact: true });
  await expect(reloadedSettings.getByLabel('運転手の人数')).toHaveValue('2');
  await page.getByRole('button', { name: 'キャンセル' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(pageErrors.get(page)).toEqual([]);
});
test('vehicle settlement presents expense and breakdown with an accessible Carbon accordion', async ({ page }) => {
  const car = page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者D車/ }) });
  const settings = page.getByRole('link', { name: '精算ルール', exact: true });
  await expect(settings).toHaveAttribute('href', /section=settlement.*task=rules/);
  await expect(car.locator('.settlement-car-payment')).toHaveCount(0);
  await expect(car.locator('.settlement-car-menu')).toHaveCount(0);
  await expect(car.getByText('未払い', { exact: true })).toHaveCount(0);
  await expect(car.getByRole('button', { name: '支払い済みにする', exact: true })).toHaveCount(0);
  await expect(car.getByRole('button', { name: /費用を入力$/ })).toBeVisible();

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
  await expect(page.getByRole('heading',{level:1,name:'仮参加者D車の費用'})).toBeVisible();
  await editFee(page,'移動条件');
  await page.getByRole('button',{name:'キャンセル',exact:true}).click();
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
  await expect(longCar.getByRole('button', { name: /費用を入力$/ })).toBeVisible();
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
  await navigateToProjectSection(page, '精算');
  await expect(page.locator('.settlement-memo-card').getByText('高速料金は武内さんが立替済み。', { exact: true })).toBeVisible();
  await expect(pageErrors.get(page)).toEqual([]);
});

test('vehicle rows omit driver payment recording and right-align a ghost expense action', async ({ page }) => {
  const car = page.locator('.settlement-car').first();
  await expect(car.getByText('支払い済み', { exact: true })).toHaveCount(0);
  await expect(car.getByText('未払い', { exact: true })).toHaveCount(0);
  await expect(car.getByRole('button', { name: '支払い済みにする', exact: true })).toHaveCount(0);
  await expect(car.getByRole('button', { name: /その他の操作/ })).toHaveCount(0);
  const expense = car.getByRole('button', { name: /費用を入力$/ });
  await expect(expense).toHaveClass(/cds--btn--ghost/);
  await expect(expense.locator('.cds--btn__icon')).toHaveCount(0);
  const alignment = await expense.evaluate(button => ({ button: button.getBoundingClientRect().toJSON(), actions: button.parentElement.getBoundingClientRect().toJSON() }));
  expect(Math.abs(alignment.button.right - alignment.actions.right)).toBeLessThanOrEqual(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expense.click();
  await expect(page.getByRole('heading',{level:1,name:'仮参加者A車の費用'})).toBeVisible();
});
