import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/legacy-v4.json', import.meta.url)));
const pageErrors = new WeakMap();

test.beforeEach(async ({ page }, testInfo) => {
  const errors = [];
  pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  const roomId = `SETTLEMENT-${testInfo.project.name}-${testInfo.retry}`;
  const initialFixture = structuredClone(fixture);
  if (testInfo.title === 'driver payment wraps long car names and formats zero amount') {
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
  await page.addInitScript(({ key, value }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value)); }, {
    key: `sanpo-react:v1:${roomId}:room`, value: initialFixture,
  });
  await page.goto(`/?room=${roomId}`);
  await page.getByRole('tab', { name: '精算', exact: true }).click();
});

test('settings cancel/save, signed extras, payment state and reload', async ({ page }) => {
  await expect(page.getByRole('heading', { name: '精算状況' })).toBeVisible();
  await expect(page.getByText('1人あたり')).toBeVisible();

  await page.getByRole('button', { name: '精算設定を編集' }).click();
  let settings = page.getByRole('dialog', { name: '精算設定を編集' });
  await settings.getByText('10円単位', { exact: true }).click();
  await page.getByRole('button', { name: 'キャンセル' }).click();
  await expect(page.getByText('100円単位')).toBeVisible();

  await page.getByRole('button', { name: '精算設定を編集' }).click();
  settings = page.getByRole('dialog', { name: '精算設定を編集' });
  await settings.getByText('10円単位', { exact: true }).click();
  await settings.getByRole('button', { name: '次へ' }).click();
  await settings.getByLabel('1台あたりの協力代（円）').fill('700');
  await settings.getByRole('button', { name: '次へ' }).click();
  await settings.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText('10円単位')).toBeVisible();

  await page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) }).getByRole('button', { name: '費用を編集' }).click();
  await page.getByRole('button', { name: '費用を追加' }).click();
  const modal = page.getByRole('dialog', { name: '仮参加者A車' });
  const lastRow = modal.locator('.settlement-cost-editor-details');
  await lastRow.getByLabel('名目').dispatchEvent('compositionstart');
  await lastRow.getByLabel('名目').fill('にほんごへんかんちゅう');
  await lastRow.getByLabel('名目').dispatchEvent('compositionend', { data: '日本語変換中の返金' });
  await lastRow.getByLabel('名目').fill('日本語変換中の返金');
  await lastRow.getByRole('textbox', { name: '金額', exact: true }).fill('300');
  await lastRow.getByText('部費', { exact: true }).click();
  await lastRow.getByRole('checkbox', { name: /この金額を(?:部費|割勘)から差し引く/ }).check({ force: true });
  await modal.getByRole('button', { name: '保存' }).click();
  const carA = page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) });
  await carA.getByRole('button', { name: /内訳を表示/ }).click();
  await expect(carA.getByText('日本語変換中の返金')).toBeVisible();

  await page.locator('label[for="settlement-paid-仮参加者C"]').click();
  await expect(page.getByRole('dialog', { name: '集金済みにする' })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: '仮参加者Cの集金チェック' })).toBeChecked();
  const driverPayment = page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者D車/ }) });
  await driverPayment.getByRole('button', { name: '支払い済みにする' }).click();

  await page.reload();
  await page.getByRole('tab', { name: '精算', exact: true }).click();
  await expect(page.getByText('10円単位')).toBeVisible();
  const reloadedCarA = page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) });
  await reloadedCarA.getByRole('button', { name: /内訳を表示/ }).click();
  await expect(reloadedCarA.getByText('日本語変換中の返金')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: '仮参加者Cの集金チェック' })).toBeChecked();
  await expect(driverPayment.getByRole('button', { name: '未払いに戻す' })).toBeVisible();
  await page.getByRole('button', { name: 'ユーティリティメニュー' }).click(); await page.getByRole('menuitem', { name: 'ダークモードに切り替え' }).click();
  await expect(page.locator('.application')).toHaveClass(/cds--g100/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(pageErrors.get(page)).toEqual([]);
});

test('registered-participant collection records directly without asking for a collector', async ({ page }) => {
  await page.locator('label[for="settlement-paid-仮参加者C"]').click();
  await expect(page.getByRole('dialog', { name: '集金済みにする' })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: '仮参加者Cの集金チェック' })).toBeChecked();
  expect(pageErrors.get(page)).toEqual([]);
});

test('car expense editor uses a compact Carbon list and focused mobile editing surface', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 703 });
  await page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) }).getByRole('button', { name: '費用を編集' }).click();
  const dialog = page.getByRole('dialog', { name: '仮参加者A車' });
  await expect(dialog.getByRole('heading', { name: '費用一覧' })).toHaveCount(0);
  await expect(dialog.locator('.settlement-cost-editor')).toHaveCount(1);
  await expect(dialog.getByRole('list', { name: '車両費用' })).toBeVisible();
  await expect(dialog.locator('.settlement-cost-editor .settlement-cost-list-item')).toHaveCount(4);
  await expect(dialog.locator('.settlement-cost-editor-chevron')).toBeVisible();
  await expect(dialog.locator('.settlement-cost-editor-chevron')).toHaveAttribute('aria-hidden', 'true');
  await expect(dialog.getByText('自動計算')).toBeVisible();
  await expect(dialog.getByRole('button', { name: '削除', exact: true })).toHaveCount(3);
  const deleteButton = dialog.getByRole('button', { name: '削除', exact: true }).first();
  await expect(deleteButton).toHaveClass(/cds--btn--danger--ghost/);
  await expect(deleteButton.locator('svg')).toBeVisible();

  const parkingTrigger = dialog.getByRole('button', { name: /駐車代/ });
  await parkingTrigger.click();
  await expect(dialog.getByLabel('名目')).toHaveValue('駐車代');
  await expect(dialog.getByRole('radio', { name: '割勘' })).toBeVisible();
  await expect(dialog.getByRole('checkbox', { name: /この金額を(?:部費|割勘)から差し引く/ })).toBeVisible();
  await expect(dialog.locator('.settlement-cost-editor-details')).toHaveCount(1);
  const rowEditor = await dialog.locator('.settlement-cost-editor-details').evaluate(node => ({
    parentClass: node.closest('.settlement-cost-editor-details-row')?.className,
    precedingRowCurrent: node.closest('.settlement-cost-editor-details-row')?.previousElementSibling?.getAttribute('aria-current'),
    belongsToOneList: node.closest('.cds--contained-list')?.classList.contains('settlement-cost-editor'),
  }));
  expect(rowEditor.parentClass).toContain('settlement-cost-editor-details-row');
  expect(rowEditor.precedingRowCurrent).toBe('true');
  expect(rowEditor.belongsToOneList).toBe(true);
  const contentFocusStyle = await dialog.locator('.cds--modal-content').evaluate(node => ({
    focused: node.matches(':focus'),
    focusVisible: node.matches(':focus-visible'),
    outline: getComputedStyle(node).outlineStyle,
  }));
  if (contentFocusStyle.focused && !contentFocusStyle.focusVisible) expect(contentFocusStyle.outline).toBe('none');
  const editorStyle = await dialog.locator('.settlement-cost-editor-details').evaluate(node => ({
    borderInlineStartWidth: getComputedStyle(node).borderInlineStartWidth,
    backgroundColor: getComputedStyle(node).backgroundColor,
    bodyBackgroundColor: getComputedStyle(node.closest('.cds--modal-content')).backgroundColor,
  }));
  expect(editorStyle.borderInlineStartWidth).toBe('0px');
  expect(editorStyle.backgroundColor).not.toBe(editorStyle.bodyBackgroundColor);
  const fieldColumns = await dialog.locator('.settlement-cost-editor-fields').evaluate(node => getComputedStyle(node).gridTemplateColumns);
  expect(fieldColumns.split(' ').length).toBe(2);
  await expect(dialog.getByRole('textbox', { name: '金額', exact: true })).toHaveCSS('text-align', 'right');
  await dialog.getByLabel('名目').press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  const keyboardFocusStyle = await dialog.evaluate(node => ({
    isRow: document.activeElement?.matches('.settlement-cost-list-item .cds--contained-list-item__content'),
    focusVisible: document.activeElement?.matches(':focus-visible'),
    outline: getComputedStyle(document.activeElement, '::after').outlineStyle,
  }));
  expect(keyboardFocusStyle.isRow).toBe(true);
  expect(keyboardFocusStyle.focusVisible).toBe(true);
  expect(keyboardFocusStyle.outline).toBe('solid');
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

test('movement settings body scrolls within a short mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 703 });
  await page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) }).getByRole('button', { name: '費用を編集' }).click();
  const dialog = page.getByRole('dialog', { name: '仮参加者A車' });
  await dialog.locator('.settlement-cost-list-item').filter({ hasText: 'ガソリン代' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  const columns = await dialog.locator('.settlement-movement-form .form-grid').evaluate(node => getComputedStyle(node).gridTemplateColumns);
  expect(columns.split(' ').length).toBe(1);
  await expect(dialog.getByRole('heading', { name: '移動料金の計算条件' })).toHaveCSS('font-size', '14px');
  const fieldStyle = await dialog.locator('.settlement-movement-form .cds--text-input').first().evaluate(node => ({
    background: getComputedStyle(node).backgroundColor,
    borderBottomStyle: getComputedStyle(node).borderBottomStyle,
  }));
  expect(fieldStyle.background).not.toBe('rgba(0, 0, 0, 0)');
  expect(fieldStyle.borderBottomStyle).toBe('solid');
  await expect(dialog.getByText('計算したガソリン代')).toBeVisible();
  await expect(dialog.locator('.settlement-movement-preview')).toContainText('計算したガソリン代¥1,633');
  await expect(dialog.locator('.settlement-movement-preview small')).toHaveCount(0);
  const routeButton = dialog.getByRole('button', { name: 'ルートから距離を計算' });
  const routeButtonLayout = await routeButton.evaluate(node => ({
    width: node.getBoundingClientRect().width,
    parentWidth: node.parentElement.getBoundingClientRect().width,
    styleWidth: getComputedStyle(node).inlineSize,
  }));
  expect(routeButtonLayout.width).toBeLessThan(routeButtonLayout.parentWidth);
  expect(routeButtonLayout.styleWidth).not.toBe('100%');
  const content = dialog.locator('.cds--modal-content');
  const before = await content.evaluate(node => ({ clientHeight: node.clientHeight, scrollHeight: node.scrollHeight, scrollTop: node.scrollTop }));
  expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);
  const headerBefore = await dialog.locator('.cds--modal-header').evaluate(node => node.getBoundingClientRect().toJSON());
  await content.hover();
  await page.mouse.wheel(0, 480);
  await expect.poll(() => content.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  await content.evaluate(node => { node.scrollTop = Math.floor((node.scrollHeight - node.clientHeight) / 2); });
  await expect(page.locator('.settlement-movement-modal')).not.toHaveClass(/settlement-movement-at-bottom/);
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
  await expect(page.locator('.settlement-movement-modal')).toHaveClass(/settlement-movement-at-bottom/);
  await expect.poll(() => content.evaluate(node => getComputedStyle(node).maskImage)).toBe('none');
  await expect(dialog.locator('.settlement-movement-preview')).toHaveCSS('opacity', '1');
  expect(pageErrors.get(page)).toEqual([]);
});

test('人数だけで精算するdraft survives save and reload', async ({ page }) => {
  await page.getByRole('button', { name: '精算設定を編集' }).click();
  const modal = page.getByRole('dialog', { name: '精算設定を編集' });
  await modal.getByText('人数だけで精算', { exact: true }).click();
  await modal.getByLabel('運転手の人数').fill('2');
  await modal.getByLabel('同乗者の人数').fill('4');
  await modal.getByLabel('運転手1の名前').fill('第一運転手');
  await modal.getByLabel('運転手2の名前').fill('第二運転手');
  await modal.getByRole('button', { name: '次へ' }).click();
  await modal.getByRole('button', { name: '次へ' }).click();
  await modal.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText('人数だけ（運転手2人・その他4人）')).toBeVisible();
  await expect(page.getByRole('heading', { name: '第一運転手車' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '第二運転手車' })).toBeVisible();
  await page.reload();
  await page.getByRole('tab', { name: '精算', exact: true }).click();
  await expect(page.getByText('人数だけ（運転手2人・その他4人）')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(pageErrors.get(page)).toEqual([]);
});
test('driver payment uses labeled status control and Carbon expandable tile', async ({ page }) => {
  const description = page.locator('.settlement-driver-payment-description');
  const descriptionLayout = await description.evaluate(element => ({ height: element.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(element).lineHeight) }));
  expect(descriptionLayout.height).toBeLessThanOrEqual(descriptionLayout.lineHeight + 1);
  const splitSummary = page.locator('.settlement-car-split-summary > span:first-child').first();
  const splitSummaryLayout = await splitSummary.evaluate(element => ({ height: element.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(element).lineHeight) }));
  expect(splitSummaryLayout.height).toBeLessThanOrEqual(splitSummaryLayout.lineHeight + 1);
  const unpaidCar = page.locator('.settlement-car').filter({ has: page.getByText('未払い', { exact: true }) }).first();
  const carName = await unpaidCar.getByRole('heading').innerText();
  const car = page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: carName, exact: true }) });
  await expect(car.getByText(/支払額/)).toBeVisible();
  await expect(car.getByText('この車への支払額', { exact: true })).toHaveCount(0);
  await expect(car.getByRole('button', { name: '費用を編集' })).toBeVisible();
  await expect(car.locator('.cds--tag__label', { hasText: '未払い' })).toBeVisible();
  await expect(car.getByRole('heading', { name: /レンタカー/ })).toBeVisible();

  const paid = car.getByRole('button', { name: '支払い済みにする' });
  await expect(paid).toBeVisible();
  await expect(paid).toBeEnabled();
  const actions = car.locator('.settlement-car-actions');
  const statusRow = actions.locator('.settlement-car-status-row');
  await car.scrollIntoViewIfNeeded();
  const tagBox = await statusRow.locator('.cds--tag').boundingBox();
  const checkboxBox = await statusRow.getByRole('button', { name: '支払い済みにする' }).boundingBox();
  const editBox = await car.getByRole('button', { name: '費用を編集' }).boundingBox();
  expect(Math.abs((tagBox.y + tagBox.height / 2) - (checkboxBox.y + checkboxBox.height / 2)), JSON.stringify({ tagBox, checkboxBox })).toBeLessThanOrEqual(3);
  if (await page.evaluate(() => innerWidth <= 672)) {
    expect(editBox.y).toBeGreaterThanOrEqual(checkboxBox.y + checkboxBox.height - 1);
  }
  await paid.click();
  await expect(car.getByRole('button', { name: '未払いに戻す' })).toBeVisible();
  await expect(car.locator('.cds--tag').filter({ hasText: '支払い済み' })).toBeVisible();
  let reversePayment = car.getByRole('button', { name: '未払いに戻す' });
  await reversePayment.focus();
  await expect(reversePayment).toBeFocused();
  await page.keyboard.press('Space');
  await expect(car.getByRole('button', { name: '支払い済みにする' })).toBeVisible();
  await expect(car.locator('.cds--tag').filter({ hasText: '未払い' })).toBeVisible();
  await car.getByRole('button', { name: '支払い済みにする' }).click();
  await expect(car.getByRole('button', { name: '未払いに戻す' })).toBeVisible();
  await car.getByRole('button', { name: '未払いに戻す' }).click();
  await expect(car.getByRole('button', { name: '支払い済みにする' })).toBeVisible();
  await expect(car.locator('.cds--tag').filter({ hasText: '未払い' })).toBeVisible();

  await car.getByRole('button', { name: '費用を編集' }).click();
  const editDialog = page.getByRole('dialog');
  await expect(editDialog).toBeVisible();
  await editDialog.getByRole('button', { name: '閉じる' }).click();

  const disclosure = car.getByRole('button', { name: `${carName}の内訳を表示` });
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
  await expect(disclosure).toHaveAttribute('aria-label', `${carName}の内訳を表示`);
  expect(await disclosure.evaluate(button => getComputedStyle(button, '::before').content)).toBe('"内訳を表示"');
  const collapsedLabel = await car.locator('.settlement-car-split-summary > span').boundingBox();
  const collapsedTrigger = await disclosure.boundingBox();
  expect(Math.abs(collapsedLabel.y + collapsedLabel.height / 2 - collapsedTrigger.y - collapsedTrigger.height / 2)).toBeLessThanOrEqual(2);
  await expect(car.locator('.settlement-cost-list')).not.toBeVisible();
  const restingColor = await disclosure.evaluate(button => getComputedStyle(button).backgroundColor);
  await disclosure.hover();
  expect(await disclosure.evaluate(button => getComputedStyle(button).backgroundColor)).not.toBe(restingColor);
  await disclosure.focus();
  await expect(disclosure).toBeFocused();
  await page.keyboard.press('Enter');
  const expandedDisclosure = car.getByRole('button', { name: `${carName}の内訳を隠す` });
  await expect(expandedDisclosure).toHaveAttribute('aria-expanded', 'true');
  expect(await expandedDisclosure.evaluate(button => getComputedStyle(button, '::before').content)).toBe('"内訳を隠す"');
  const expandedLabel = await car.locator('.settlement-car-split-summary > span').boundingBox();
  const expandedTrigger = await expandedDisclosure.boundingBox();
  expect(Math.abs(expandedLabel.y + expandedLabel.height / 2 - expandedTrigger.y - expandedTrigger.height / 2)).toBeLessThanOrEqual(2);
  await expect(car.locator('.settlement-cost-collapse-hint')).toHaveCount(0);
  await expect(car.getByText(/割勘 .*・部費/)).toBeVisible();
  await expect(car.locator('.settlement-cost-list')).toBeVisible();
  await expandedDisclosure.evaluate(button => button.blur());
  await expandedDisclosure.focus();
  await page.keyboard.press('Enter');
  await expect(car.getByRole('button', { name: `${carName}の内訳を表示` })).toHaveAttribute('aria-expanded', 'false');
  await disclosure.evaluate(button => button.blur());
  const lightBackground = await car.evaluate(tile => getComputedStyle(tile).backgroundColor);
  await page.getByRole('button', { name: 'ユーティリティメニュー' }).click();
  await page.getByRole('menuitem', { name: 'ダークモードに切り替え' }).click();
  await expect(page.locator('.application')).toHaveClass(/cds--g100/);
  expect(await car.evaluate(tile => getComputedStyle(tile).backgroundColor)).not.toBe(lightBackground);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('driver payment wraps long car names and formats zero amount', async ({ page }) => {
  const longCar = page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /とても長い確認用のレンタカー車名/ }) });
  await expect(longCar.locator('.settlement-car-payment').getByText('¥0', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const tile = await longCar.boundingBox();
  const viewportWidth = await page.evaluate(() => innerWidth);
  expect(tile.x + tile.width).toBeLessThanOrEqual(viewportWidth);
  const tiles = page.locator('.settlement-car');
  for (let index = 0; index < await tiles.count(); index += 1) {
    const current = tiles.nth(index);
    const summary = current.locator('.settlement-car-split-summary > span');
    const summaryLayout = await summary.evaluate(element => ({ rect: element.getBoundingClientRect().toJSON(), height: element.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(element).lineHeight) }));
    const trigger = await current.locator('.cds--tile__chevron--interactive').boundingBox();
    expect(summaryLayout.height).toBeLessThanOrEqual(summaryLayout.lineHeight + 1);
    expect(summaryLayout.rect.right + 4).toBeLessThanOrEqual(trigger.x);
    const tag = await current.locator('.settlement-car-status-row .cds--tag').boundingBox();
    const checkbox = await current.locator('.settlement-car-status-row button').boundingBox();
    const edit = await current.getByRole('button', { name: '費用を編集' }).boundingBox();
    if (viewportWidth <= 672) {
      expect(Math.abs((tag.y + tag.height / 2) - (checkbox.y + checkbox.height / 2)), JSON.stringify({ tag, checkbox, statusRow: await current.locator('.settlement-car-status-row').evaluate(element => ({ alignItems: getComputedStyle(element).alignItems, children: [...element.children].map(child => ({ display: getComputedStyle(child).display, alignSelf: getComputedStyle(child).alignSelf })) })) })).toBeLessThanOrEqual(3);
      expect(edit.y).toBeGreaterThanOrEqual(checkbox.y + checkbox.height - 1);
    }
    if (index < (await tiles.count()) - 1) {
      const border = await current.evaluate(element => getComputedStyle(element).borderBlockEndWidth);
      expect(parseFloat(border)).toBeGreaterThan(0);
    }
  }
});
