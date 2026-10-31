import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

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

test('guide labels stay on one line at mobile width and retain their order on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.getByRole('button', { name: 'その他の操作' }).click();
  await page.getByRole('menuitem', { name: '使い方', exact: true }).click();
  const guide = page.getByRole('dialog', { name: '使い方' });
  await expect(guide.locator('.user-guide ul')).toBeVisible();
  await expect(guide.locator('.user-guide ol')).toHaveCount(0);
  const mobile = await guide.locator('.user-guide li > strong').evaluateAll(nodes => nodes.map(node => {
    const rect = node.getBoundingClientRect();
    return { text: node.textContent, height: rect.height, lineHeight: parseFloat(getComputedStyle(node).lineHeight) };
  }));
  expect(mobile.filter(item => ['参加者', '共有', '精算'].includes(item.text)).every(item => item.height <= item.lineHeight + 1), JSON.stringify(mobile)).toBe(true);
  expect(await guide.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await guide.getByRole('button', { name: '閉じる' }).click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('button', { name: 'その他の操作' }).click();
  await page.getByRole('menuitem', { name: '使い方', exact: true }).click();
  const desktop = await page.getByRole('dialog', { name: '使い方' }).locator('.user-guide li > strong').allTextContents();
  expect(desktop).toEqual(['応募フォーム', '参加者', '車割・班割', '精算', '共有']);
});

test('settlement settings use a medium progress dialog and disable back on the first step', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.getByRole('tab', { name: '精算', exact: true }).click({ force: true });
  await page.getByRole('button', { name: '精算設定' }).click({ force: true });
  const dialog = page.getByRole('dialog', { name: '精算設定を編集' });
  await expect(dialog).toHaveClass(/cds--modal-container--md/);
  await expect(dialog.getByRole('button', { name: '戻る' })).toBeDisabled();
  await expect(dialog.locator('.cds--progress')).toHaveCount(0);
  const footer = await dialog.locator('.cds--modal-footer').evaluate(node => {
    const buttons = [...node.querySelectorAll('button')].map(button => ({ text: button.textContent.trim(), x: button.getBoundingClientRect().x }));
    return { buttons, width: node.getBoundingClientRect().width };
  });
  expect(footer.buttons[0].text).toBe('キャンセル');
  expect(footer.buttons[0].x).toBeLessThan(footer.width / 2);
  await dialog.getByRole('button', { name: '次へ' }).click();
  await expect(dialog.getByRole('heading', { name: '車出し協力代' })).toBeFocused();
  await dialog.getByLabel('1台あたりの協力代（円）').fill('1000');
  await page.setViewportSize({ width: 400, height: 852 });
  await expect(dialog.locator('.cds--progress')).toBeVisible();
  await dialog.getByRole('button', { name: '戻る' }).click();
  await expect(dialog.getByRole('radio', { name: '参加者を登録して精算' })).toBeChecked();
  await dialog.getByRole('button', { name: '次へ' }).click();
  await expect(dialog.getByLabel('1台あたりの協力代（円）')).toHaveValue('1000');
  await dialog.getByRole('button', { name: '次へ' }).click();
  await expect(dialog.getByRole('button', { name: '保存' })).toBeVisible();
  await dialog.getByRole('button', { name: 'キャンセル' }).click();
  await expect(dialog).toHaveCount(0);

  await page.getByRole('button', { name: '精算設定' }).click();
  const standaloneDialog = page.getByRole('dialog', { name: '精算設定を編集' });
  await standaloneDialog.locator('label[for="settlement-mode-standalone"]').click();
  await standaloneDialog.getByLabel('運転手の人数').fill('1');
  await standaloneDialog.getByRole('button', { name: '次へ' }).click();
  await standaloneDialog.getByRole('button', { name: '次へ' }).click();
  await expect(standaloneDialog.getByRole('button', { name: '保存' })).toBeVisible();
  await standaloneDialog.getByRole('button', { name: 'キャンセル' }).click();
});

test('short modal headers do not scroll and long Japanese vehicle titles stay clear of close controls', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('webkit-'), 'WebKit automation stalls after viewport resize before layout measurement; keep this geometry assertion on Chromium and record WebKit as unverified.');
  await page.setViewportSize({ width: 393, height: 667 });
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('tab', { name: '精算', exact: true }).click({ force: true });
  await page.getByRole('button', { name: '精算設定' }).click({ force: true });
  const shortDialog = page.getByRole('dialog', { name: '精算設定を編集' });
  const shortHeader = await shortDialog.locator('.cds--modal-header').evaluate(node => ({
    clientHeight: node.clientHeight,
    scrollHeight: node.scrollHeight,
    overflowY: getComputedStyle(node).overflowY,
  }));
  expect(shortHeader.scrollHeight).toBeLessThanOrEqual(shortHeader.clientHeight + 1);
  expect(shortHeader.overflowY).toBe('visible');
  await shortDialog.getByRole('button', { name: 'キャンセル' }).click({ force: true });

  const roomId = `LONG-MODAL-TITLE-${testInfo.project.name}-${testInfo.retry}`;
  const room = structuredClone(fixture);
  const longName = '藤原拓海'.repeat(20);
  room.cars[0].name = longName;
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: `sanpo-react:v1:${roomId}:room`, value: room,
  });
  await page.goto(`/?room=${roomId}&view=seisan`);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: new RegExp(longName) }) })
    .getByRole('button', { name: new RegExp(`${longName}車の費用を`) }).click({ force: true });
  const dialog = page.getByRole('dialog', { name: new RegExp(`${longName}車：費用を編集`) });
  const titleLayout = await dialog.locator('.cds--modal-header').evaluate(node => {
    const label = node.querySelector('.cds--modal-header__label').getBoundingClientRect();
    const close = node.querySelector('.cds--modal-close').getBoundingClientRect();
    return { header: node.getBoundingClientRect().toJSON(), label: label.toJSON(), close: close.toJSON(), scrollWidth: node.scrollWidth, clientWidth: node.clientWidth };
  });
  expect(titleLayout.scrollWidth).toBeLessThanOrEqual(titleLayout.clientWidth + 1);
  expect(titleLayout.label.right).toBeLessThanOrEqual(titleLayout.close.left + 1);
  await expect(dialog.getByRole('button', { name: '閉じる' })).toBeVisible();
  await dialog.getByRole('button', { name: 'キャンセル' }).click({ force: true });
  await expect(dialog).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: new RegExp(longName) }) })
    .getByRole('button', { name: new RegExp(`${longName}車の費用を`) }).click({ force: true });
  const desktopDialog = page.getByRole('dialog', { name: new RegExp(`${longName}車：費用を編集`) });
  const desktopTitleLayout = await desktopDialog.locator('.cds--modal-header').evaluate(node => {
    const label = node.querySelector('.cds--modal-header__label').getBoundingClientRect();
    const close = node.querySelector('.cds--modal-close').getBoundingClientRect();
    return { label: label.toJSON(), close: close.toJSON(), scrollWidth: node.scrollWidth, clientWidth: node.clientWidth };
  });
  expect(desktopTitleLayout.scrollWidth).toBeLessThanOrEqual(desktopTitleLayout.clientWidth + 1);
  expect(desktopTitleLayout.label.right).toBeLessThanOrEqual(desktopTitleLayout.close.left + 1);
});

test('primary dialogs retain viewport margins and usable actions', async ({ page }, testInfo) => {
  const errors = [];
  const evidence = process.env.MIGRATION_EVIDENCE_DIR || join(tmpdir(), 'circle-react-migration-evidence');
  page.on('pageerror', error => errors.push(error.message));

  await page.getByRole('tab', { name: '車割', exact: true }).click();
  await page.getByRole('button', { name: '車を追加', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: '車を追加' });
  await expectViewportFrame(page, dialog);
  await dialog.getByRole('button', { name: 'キャンセル' }).click();

  await page.getByRole('tab', { name: '班割', exact: true }).click();
  await page.getByRole('button', { name: '班を追加', exact: true }).click();
  dialog = page.getByRole('dialog', { name: '班を追加' });
  await expectViewportFrame(page, dialog);
  await dialog.getByRole('button', { name: 'キャンセル' }).click();

  await page.getByRole('tab', { name: '精算', exact: true }).click();
  await page.getByRole('button', { name: '精算設定' }).click();
  dialog = page.getByRole('dialog', { name: '精算設定を編集' });
  await expectViewportFrame(page, dialog);
  if (testInfo.project.name.includes('mobile')) {
    await expect(dialog.getByRole('status')).toContainText('ステップ 1/3');
    await expect(dialog.getByRole('status')).toContainText('精算方法');
    await expect(dialog.locator('.cds--progress')).toHaveCount(0);
  } else {
    await expect(dialog.locator('.cds--progress-label')).toHaveText(['精算方法', '車出し協力代', '集金ルール']);
    await expect(dialog.locator('.cds--progress')).not.toHaveClass(/cds--progress--vertical/);
  }
  await expect(dialog.locator('.cds--modal-footer button')).toHaveText(['キャンセル', '戻る', '次へ']);
  await expect(dialog.getByRole('radio', { name: '参加者を登録して精算' })).toBeChecked();
  await expect(dialog.getByRole('radio', { name: '100円単位' })).toBeChecked();
  await page.screenshot({ path: join(evidence, `settlement-wizard-${testInfo.project.name}.png`) });
  await dialog.getByRole('button', { name: 'キャンセル' }).click();

  await page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) }).getByRole('button', { name: /の費用を(?:入力|編集)$/ }).click();
  dialog = page.getByRole('dialog', { name: /^仮参加者A車：/ });
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expectViewportFrame(page, dialog);
  await expect(dialog.getByRole('heading', { name: '費用を編集' })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: '費用一覧' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: '計算条件を変更' })).toHaveCount(0);
  if (testInfo.project.name.includes('mobile')) {
    const expenseFrame = await dialog.evaluate(node => ({ ...node.getBoundingClientRect().toJSON(), viewportHeight: innerHeight }));
    expect(Math.abs(expenseFrame.bottom - expenseFrame.viewportHeight)).toBeLessThan(1);
    expect(expenseFrame.height).toBeLessThan(expenseFrame.viewportHeight * .85);
  }
  await expect(dialog.getByRole('button', { name: '費用を保存' })).toBeVisible();
  if (testInfo.project.name.includes('mobile')) {
    const compactRow = await dialog.locator('.settlement-cost-list-item .settlement-cost-summary').first().evaluate(row => {
      const name = row.querySelector('.settlement-cost-summary__name').getBoundingClientRect();
      const amount = row.querySelector('.settlement-cost-summary__amount').getBoundingClientRect();
      return Math.abs(name.top - amount.top) < 64 && amount.left > name.left;
    });
    expect(compactRow).toBe(true);
  }
  await page.screenshot({ path: join(evidence, `vehicle-expense-${testInfo.project.name}.png`) });
  await dialog.getByRole('button', { name: '新しい費用を追加' }).click();
  await dialog.getByLabel('費用名').last().fill('保持する費用');
  await dialog.getByRole('button', { name: '戻る' }).click();
  await dialog.getByRole('button', { name: 'ガソリン代の計算条件を編集' }).click();

  const movement = page.getByRole('dialog', { name: /^仮参加者A車：/ });
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(movement.getByRole('heading', { name: 'ガソリン代を設定' })).toBeVisible();
  await expectViewportFrame(page, movement);
  await expect(movement.getByRole('heading', { name: 'ガソリン代の計算条件' })).toBeVisible();
  await movement.getByLabel('移動距離（km）').fill('42');
  await movement.getByRole('button', { name: 'ルートから距離を計算' }).click();

  const route = page.getByRole('dialog', { name: /^仮参加者A車：/ });
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expectViewportFrame(page, route);
  await expect(route.getByRole('heading', { name: 'ルートから距離を計算' })).toBeVisible();
  await page.screenshot({ path: join(evidence, `route-planner-${testInfo.project.name}.png`) });
  await route.getByRole('button', { name: '戻る' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expectViewportFrame(page, movement);
  await expect(movement.getByLabel('移動距離（km）')).toHaveValue('42');
  await movement.getByRole('button', { name: 'ガソリン代を適用' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  dialog = page.getByRole('dialog', { name: /^仮参加者A車：/ });
  await expectViewportFrame(page, dialog);
  await expect(dialog.locator('.settlement-cost-list-item').filter({ hasText: '保持する費用' })).toBeVisible();
  await dialog.getByRole('button', { name: 'キャンセル' }).click();

  await page.getByRole('button', { name: 'その他の操作' }).click();
  const appMenu = page.getByRole('menu', { name: 'その他の操作' });
  await expect(appMenu.getByRole('menuitem')).toHaveText(['企画名を変更', '使い方', 'サンプルデータ', 'ダークモードに切り替え', '不具合を報告']);
  await appMenu.getByRole('menuitem', { name: 'ダークモードに切り替え' }).click();
  await expect(page.locator('.application')).toHaveClass(/cds--g100/);
  await page.getByRole('button', { name: '精算設定' }).click();
  dialog = page.getByRole('dialog', { name: '精算設定を編集' });
  await expectViewportFrame(page, dialog);
  expect(await dialog.evaluate(node => getComputedStyle(node).backgroundColor)).not.toBe('rgb(255, 255, 255)');
  await page.screenshot({ path: join(evidence, `settlement-wizard-dark-${testInfo.project.name}.png`) });
  await dialog.getByRole('button', { name: 'キャンセル' }).click();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
