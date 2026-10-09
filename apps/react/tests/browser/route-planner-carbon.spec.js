import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/legacy-v4.json', import.meta.url)));

test.beforeEach(async ({ page }, testInfo) => {
  const roomId = `ROUTE-CARBON-${testInfo.project.name}-${testInfo.retry}`;
  await page.setViewportSize({ width: 390, height: 844 });
  const initialRoom = structuredClone(fixture);
  if (testInfo.title === 'route planner shares place history and shows its privacy notice once per room and device') {
    initialRoom.settlement.routePlaceCatalog = [{ placeId: 'shared-history', name: '共有済み施設', address: '長野県松本市', latitude: 36.2, longitude: 138.2 }];
  }
  await page.addInitScript(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
    window.__REACT_ROUTE_ADAPTER__ = {
      async search(query) {
        if (query === '待機') await new Promise(resolve => setTimeout(resolve, 700));
        if (query === '失敗') throw new TypeError('Cannot read properties of null (reading placeId)');
        if (query === 'なし') return [];
        return [{ placeId: `place-${query}`, query, name: query, address: 'テスト住所', latitude: 35, longitude: 139 }];
      },
      async resolve(prediction) { return { placeId: prediction.placeId || prediction.query, name: prediction.name || prediction.query, address: prediction.address || '', latitude: 35, longitude: 139 }; },
      async calculate(state) { return { ...state, routes: state.origin && state.destination ? [{ id: 'main-route', label: '', distanceMeters: 12345, durationSeconds: 2700, legs: [{ fromName: state.origin.name, toName: state.destination.name, distanceMeters: 12345, durationSeconds: 2700 }] }] : [], selectedRouteIndex: 0, calculatedAt: Date.now() }; },
    };
  }, { key: `sanpo-react:v1:${roomId}:room`, value: initialRoom });
  await page.goto(`/?room=${roomId}&view=seisan`);
});

test('route planner shares place history and shows its privacy notice once per room and device', async ({ page }) => {
  const car = page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) });
  await car.getByRole('button', { name: '費用を入力' }).click();
  let modal = page.getByRole('dialog', { name: '仮参加者A車' });
  await modal.getByRole('button', { name: 'ガソリン代の計算条件を編集' }).click();
  await modal.getByRole('button', { name: '移動距離計算ツール' }).click();
  await expect(modal.getByRole('heading', { name: '移動距離計算ツール' })).toBeVisible();
  await expect(modal.locator('.route-planner-callout')).toContainText('追加した場所は企画内で共有されます。');
  await expect(modal.locator('.route-planner-callout')).toContainText('自宅の住所の入力は避け、近隣の施設などを代わりに入力してください。');

  await modal.getByRole('button', { name: /出発地を追加/ }).click();
  await expect(modal.locator('.route-place-results')).toContainText('共有済み施設');
  const search = modal.getByRole('searchbox', { name: '場所を検索' });
  await search.fill('追加候補');
  await expect(modal.locator('.route-place-results')).toHaveCount(0);
  await expect(modal.locator('.route-place-results')).toContainText('追加候補');
  await expect(modal.locator('.route-place-results')).not.toContainText('共有済み施設');
  await modal.getByRole('button', { name: '検索語を消去' }).click();
  await expect(modal.locator('.route-place-results')).toContainText('共有済み施設');
  await search.fill('追加候補');
  await expect(modal.locator('.route-place-results')).toContainText('追加候補');
  await expect(modal.locator('.route-place-results')).not.toContainText('共有済み施設');
  await modal.locator('.route-place-results').getByText('追加候補', { exact: true }).click();
  await expect(modal.getByRole('heading', { name: '移動距離計算ツール' })).toBeVisible();
  await modal.getByRole('button', { name: /目的地を追加/ }).click();
  await expect(modal.locator('.route-place-results')).toContainText('追加候補');
  await modal.getByRole('searchbox', { name: '場所を検索' }).fill('目的地候補');
  await expect(modal.locator('.route-place-results')).toContainText('目的地候補');
  await modal.locator('.route-place-results').getByText('目的地候補', { exact: true }).click();
  await expect(modal.getByText('12.35km・45分')).toBeVisible();
  await expect(modal.getByRole('radio')).toHaveCount(0);
  await expect(modal.getByRole('button', { name: /地図を表示/ })).toHaveCount(0);
  await modal.getByRole('button', { name: /12\.35km を適用/ }).click();

  await modal.getByRole('button', { name: '閉じる' }).click();
  await car.getByRole('button', { name: '費用を入力' }).click();
  modal = page.getByRole('dialog', { name: '仮参加者A車' });
  await modal.getByRole('button', { name: 'ガソリン代の計算条件を編集' }).click();
  await modal.getByRole('button', { name: '移動距離計算ツール' }).click();
  await expect(modal.locator('.route-planner-callout')).toHaveCount(0);
});

test('route planner uses Carbon rows, Search states, modal footer navigation, and mobile framing', async ({ page }, testInfo) => {
  const evidence = join(tmpdir(), 'circle-react-migration-evidence', 'route-carbon');
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) }).getByRole('button', { name: '費用を入力' }).click();
  const modal = page.getByRole('dialog', { name: '仮参加者A車' });
  const expenseRow = modal.locator('.settlement-cost-list-item').filter({ hasText: '駐車代' });
  const expenseName = expenseRow.locator('.settlement-cost-summary__name');
  const expenseAmount = expenseRow.locator('.settlement-cost-summary__amount');
  const expenseEdit = expenseRow.getByRole('button', { name: '駐車代を編集' });
  const [expenseNameBox, expenseAmountBox, expenseEditBox] = await Promise.all([expenseName.boundingBox(), expenseAmount.boundingBox(), expenseEdit.boundingBox()]);
  expect(expenseEditBox.x).toBeGreaterThan(expenseNameBox.x);
  expect(expenseAmountBox.x + expenseAmountBox.width).toBeLessThanOrEqual(expenseEditBox.x + 1);
  await expect(modal.locator('.settlement-cost-editor')).toHaveCount(1);
  await expect(modal.locator('.settlement-cost-editor .settlement-cost-list-item')).toHaveCount(4);
  await modal.getByRole('button', { name: 'ガソリン代の計算条件を編集' }).click();
  await expect(modal.getByRole('heading', { name: 'ガソリン代を設定' })).toBeVisible();
  const movementFormGap = await modal.locator('.settlement-movement-form').evaluate(node => getComputedStyle(node).rowGap);
  expect(movementFormGap).toBe('12px');
  const gasBody = modal.locator('.cds--modal-content');
  await gasBody.evaluate(node => { node.scrollTop = node.scrollHeight; node.dispatchEvent(new Event('scroll', { bubbles: true })); });
  await expect(page.locator('.cds--modal.is-visible')).toHaveClass(/settlement-modal-at-bottom/);
  await expect(gasBody).toHaveCSS('mask-image', 'none');
  await page.screenshot({ path: join(evidence, `gas-settings-mobile-light-${testInfo.project.name}.png`) });
  await modal.getByRole('button', { name: '移動距離計算ツール' }).click();
  await expect(modal.getByRole('heading', { name: '移動距離計算ツール' })).toBeVisible();

  const routeModal = page.getByRole('dialog', { name: '仮参加者A車' });
  const frame = await routeModal.evaluate(node => {
    const rect = node.getBoundingClientRect();
    return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: innerWidth, height: innerHeight };
  });
  expect(frame.x).toBe(0);
  expect(frame.right).toBe(frame.width);
  expect(Math.abs(frame.bottom - frame.height)).toBeLessThan(1);

  const routeRows = routeModal.locator('.route-stop-list .route-stop-item .cds--contained-list-item__content');
  const routeRowHeights = await routeRows.evaluateAll(rows => rows.map(row => row.getBoundingClientRect().height));
  await expect(routeModal.locator('.cds--contained-list')).toBeVisible();
  await expect(routeRows).toHaveCount(2);
  expect(routeRowHeights.every(height => height >= 72 && height <= 80)).toBe(true);
  const markerSizes = await routeModal.locator('.route-stop-marker').evaluateAll(markers => markers.map(marker => getComputedStyle(marker).inlineSize));
  expect(markerSizes).toEqual(['20px', '20px']);
  const markerColors = await routeModal.locator('.route-stop-marker').first().evaluate(node => {
    const style = getComputedStyle(node);
    return [style.color, style.backgroundColor];
  });
  expect(markerColors[0]).not.toBe(markerColors[1]);
  const callout = routeModal.locator('.route-planner-callout');
  await expect(callout).toContainText('追加した場所は企画内で共有されます。');
  await expect(callout).toContainText('自宅の住所の入力は避け、近隣の施設などを代わりに入力してください。');
  const routeHeading = routeModal.locator('.route-stop-list .cds--contained-list__header');
  const [calloutBox, headingBox] = await Promise.all([callout.boundingBox(), routeHeading.boundingBox()]);
  expect(Math.abs(calloutBox.x - headingBox.x)).toBeLessThan(1);
  const calloutWidth = calloutBox.width;
  expect(calloutWidth).toBeGreaterThanOrEqual(340);
  await expect(routeModal.locator('.cds--actionable-notification')).toHaveClass(/--warning/);
  const routeEmpty = routeModal.locator('.route-empty');
  await expect(routeEmpty).toHaveText('出発地と目的地を選択すると、ルートを表示します。');
  await expect(routeEmpty).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  const routeBodyOverflow = await routeModal.locator('.cds--modal-content').evaluate(node => ({ scrollHeight: node.scrollHeight, clientHeight: node.clientHeight, maskImage: getComputedStyle(node).maskImage }));
  if (routeBodyOverflow.scrollHeight <= routeBodyOverflow.clientHeight + 1) expect(routeBodyOverflow.maskImage).toBe('none');
  const emptyContrast = await routeEmpty.evaluate(node => {
    const parse = value => value.match(/[\d.]+/g).slice(0, 3).map(Number).map(channel => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    const foreground = parse(getComputedStyle(node).color);
    const background = parse(getComputedStyle(node.closest('.cds--modal-container')).backgroundColor);
    const luminance = rgb => rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  });
  expect(emptyContrast).toBeGreaterThanOrEqual(4.5);
  await expect(routeModal.getByRole('button', { name: 'この距離を適用' })).toBeDisabled();
  const routeBody = routeModal.locator('.cds--modal-content');
  await routeBody.evaluate(node => { node.scrollTop = node.scrollHeight; node.dispatchEvent(new Event('scroll', { bubbles: true })); });
  await expect(page.locator('.cds--modal.is-visible')).toHaveClass(/settlement-modal-at-bottom/);
  await expect(routeBody).toHaveCSS('mask-image', 'none');
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  await page.mouse.move(1, 1);
  await page.screenshot({ path: join(evidence, `route-planner-mobile-light-${testInfo.project.name}.png`) });

  await routeModal.getByRole('button', { name: 'ルート設定' }).click();
  await expect(routeModal.getByRole('checkbox', { name: '有料道路を使う' })).toBeVisible();
  await routeModal.getByRole('button', { name: 'ルート設定を閉じる' }).click();
  await expect(routeModal.getByRole('button', { name: /地図/ })).toHaveCount(0);
  const originRow = routeModal.getByRole('button', { name: /出発地を追加/ });
  await originRow.hover();
  await expect(originRow).toHaveCSS('cursor', 'pointer');
  await originRow.press('Enter');
  const search = routeModal.getByRole('searchbox', { name: '場所を検索' });
  await expect(search).toBeVisible();
  await expect(routeModal.getByRole('button', { name: '戻る' })).toBeVisible();
  await expect(routeModal.getByRole('button', { name: '戻る' })).toHaveCount(1);
  await expect(routeModal.getByRole('button', { name: 'この距離を適用' })).toHaveCount(0);
  await expect(routeModal.locator('.route-place-search-toolbar button')).toHaveCount(0);
  await expect(search).toHaveCSS('border-bottom-style', 'solid');
  await search.focus();
  await page.screenshot({ path: join(evidence, `route-search-focus-${testInfo.project.name}.png`) });

  await search.fill('待機');
  await expect(routeModal.getByText('場所を検索しています')).toBeVisible();
  await expect(routeModal.locator('.route-place-results')).toHaveCount(0);
  await expect(routeModal.getByText('一致する場所がありません。', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: join(evidence, `route-search-loading-${testInfo.project.name}.png`) });
  await expect(routeModal.locator('.route-place-results')).toBeVisible();
  await expect(routeModal.getByText('待機', { exact: true })).toBeVisible();
  await page.screenshot({ path: join(evidence, `route-search-results-${testInfo.project.name}.png`) });

  await search.fill('なし');
  await expect(routeModal.getByText('一致する場所がありません。', { exact: true })).toBeVisible();
  await expect(routeModal.locator('.route-place-results')).toHaveCount(0);
  await expect(routeModal.locator('.cds--inline-notification')).toHaveCount(0);
  await page.screenshot({ path: join(evidence, `route-search-empty-${testInfo.project.name}.png`) });

  await search.fill('失敗');
  const searchError = routeModal.locator('.cds--inline-notification');
  await expect(searchError).toContainText('場所を検索できませんでした');
  await expect(searchError).toContainText('もう一度お試しください。');
  await expect(searchError).not.toContainText('Cannot read properties');
  await expect(routeModal.getByText('一致する場所がありません。', { exact: true })).toHaveCount(0);
  await expect(routeModal.locator('.route-place-results')).toHaveCount(0);
  await page.screenshot({ path: join(evidence, `route-search-error-${testInfo.project.name}.png`) });

  await routeModal.getByRole('button', { name: '戻る' }).click();
  await expect(routeModal.locator('.route-stop-list')).toBeVisible();
  await expect(routeModal.getByRole('button', { name: 'この距離を適用' })).toBeDisabled();
  const waypointAction = routeModal.getByRole('button', { name: '経由地を追加' });
  await expect(routeModal.locator('.route-waypoint-action').getByRole('button', { name: '経由地を追加' })).toBeVisible();
  const [waypointBox, waypointContentBox] = await Promise.all([waypointAction.boundingBox(), routeModal.locator('.route-waypoint-action .cds--contained-list-item__content').boundingBox()]);
  expect(Math.abs(waypointBox.width - waypointContentBox.width)).toBeLessThan(2);
  await waypointAction.focus();
  await expect(waypointAction).toBeFocused();
  const toolbarButtons = await routeModal.locator('.route-toolbar .cds--btn').evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().toJSON()));
  expect(toolbarButtons).toHaveLength(1);
  await waypointAction.press('Enter');
  await expect(routeModal.getByRole('searchbox', { name: '場所を検索' })).toBeVisible();
  await routeModal.getByRole('button', { name: '戻る' }).click();
  await routeModal.getByRole('button', { name: '閉じる' }).click();
  await page.getByRole('button', { name: 'ユーティリティメニュー' }).click();
  await page.getByRole('menuitem', { name: 'ダークモードに切り替え' }).click();
  await expect(page.locator('.application')).toHaveClass(/cds--g100/);
  await page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) }).getByRole('button', { name: '費用を入力' }).click();
  const darkModal = page.getByRole('dialog', { name: '仮参加者A車' });
  await darkModal.getByRole('button', { name: 'ガソリン代の計算条件を編集' }).click();
  const darkFuelField = await darkModal.locator('.settlement-movement-form .cds--text-input').first().evaluate(node => ({
    background: getComputedStyle(node).backgroundColor,
    borderBottomStyle: getComputedStyle(node).borderBottomStyle,
  }));
  expect(darkFuelField.background).not.toBe('rgba(0, 0, 0, 0)');
  expect(darkFuelField.borderBottomStyle).toBe('solid');
  const darkGasBody = darkModal.locator('.cds--modal-content');
  await darkGasBody.evaluate(node => { node.scrollTop = node.scrollHeight; node.dispatchEvent(new Event('scroll', { bubbles: true })); });
  await expect(page.locator('.cds--modal.is-visible')).toHaveClass(/settlement-modal-at-bottom/);
  await expect(darkGasBody).toHaveCSS('mask-image', 'none');
  await page.screenshot({ path: join(evidence, `gas-settings-mobile-dark-${testInfo.project.name}.png`) });
  await darkModal.getByRole('button', { name: '移動距離計算ツール' }).click();
  await expect(darkModal.locator('.route-planner-callout')).toHaveCount(0);
  await page.screenshot({ path: join(evidence, `route-planner-mobile-dark-${testInfo.project.name}.png`) });
  expect(pageErrors).toEqual([]);
});
