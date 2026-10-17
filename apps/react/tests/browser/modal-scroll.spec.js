import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/legacy-v4.json', import.meta.url)));

test('expense editor does not fade the end of content that fits', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 483, height: 676 });
  const roomId = `MODAL-SCROLL-FIT-${testInfo.project.name}-${testInfo.retry}`;
  const room = structuredClone(fixture);
  room.settlement.cars['仮参加者A'].extras = [
    { id: 'parking-a', name: '駐車場', amount: '200', type: 'split' },
    { id: 'highway-a', name: '高速代', amount: '1800', type: 'split' },
  ];
  room.settlement.cars['仮参加者D'].extras = [
    { id: 'parking-d', name: '駐車場', amount: '200', type: 'split' },
  ];
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: `sanpo-react:v1:${roomId}:room`,
    value: room,
  });
  await page.goto(`/?room=${roomId}&view=seisan`);
  await page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) })
    .getByRole('button', { name: /の費用を(?:入力|編集)$/ }).click();

  const dialog = page.getByRole('dialog', { name: /^仮参加者A車：/ });
  const body = dialog.locator('.cds--modal-content');
  await expect(dialog.getByRole('button', { name: '新しい費用を追加' })).toBeVisible();
  const scroll = await body.evaluate(node => ({
    clientHeight: node.clientHeight,
    scrollHeight: node.scrollHeight,
    mask: getComputedStyle(node).maskImage,
    webkitMask: getComputedStyle(node).webkitMaskImage,
  }));
  expect(scroll.scrollHeight).toBeLessThanOrEqual(scroll.clientHeight + 1);
  expect(scroll.mask).toBe('none');
  expect(scroll.webkitMask).toBe('none');
});

test('long expense editor scrolls and reveals its end without a false fade', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 640 });
  const roomId = `MODAL-SCROLL-LONG-${testInfo.project.name}-${testInfo.retry}`;
  const room = structuredClone(fixture);
  room.settlement.cars['仮参加者A'].extras = Array.from({ length: 12 }, (_, index) => ({
    id: `extra-scroll-${index}`,
    name: `費用${index + 1}`,
    amount: String((index + 1) * 100),
    type: 'split',
  }));
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: `sanpo-react:v1:${roomId}:room`,
    value: room,
  });
  await page.goto(`/?room=${roomId}&view=seisan`);
  await page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) })
    .getByRole('button', { name: /の費用を(?:入力|編集)$/ }).click();

  const dialog = page.getByRole('dialog', { name: /^仮参加者A車：/ });
  const body = dialog.locator('.cds--modal-content');
  await expect(body.locator('.settlement-cost-list-item')).toHaveCount(13);
  await expect.poll(() => body.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
  const initialMask = await body.evaluate(node => getComputedStyle(node).maskImage);
  expect(initialMask).not.toBe('none');

  await body.hover();
  await page.mouse.wheel(0, 2000);
  await expect.poll(() => body.evaluate(node => node.scrollTop + node.clientHeight >= node.scrollHeight - 2)).toBe(true);
  await expect(body.locator('.settlement-cost-list-item').last()).toBeInViewport();
  await expect(page.locator('.cds--modal.is-visible')).toHaveClass(/settlement-modal-at-bottom/);
  await expect.poll(() => body.evaluate(node => getComputedStyle(node).maskImage)).toBe('none');
});

test('movement settings fit the viewport when content fits and share the modal surface', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 852 });
  const roomId = `MOVEMENT-FIT-${testInfo.project.name}-${testInfo.retry}`;
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: `sanpo-react:v1:${roomId}:room`, value: structuredClone(fixture),
  });
  await page.goto(`/?room=${roomId}&view=seisan`);
  await page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) })
    .getByRole('button', { name: /の費用を(?:入力|編集)$/ }).click();
  let dialog = page.getByRole('dialog', { name: /^仮参加者A車：/ });
  await dialog.getByRole('button', { name: 'ガソリン代の計算条件を編集' }).click();
  dialog = page.getByRole('dialog', { name: '仮参加者A車：ガソリン代を設定' });
  const body = dialog.locator('.cds--modal-content');
  const frame = await dialog.evaluate(node => ({
    height: node.getBoundingClientRect().height,
    viewport: innerHeight,
    bodyHeight: node.querySelector('.cds--modal-content').clientHeight,
    bodyScroll: node.querySelector('.cds--modal-content').scrollHeight,
    headerColor: getComputedStyle(node.querySelector('.cds--modal-header')).backgroundColor,
    bodyColor: getComputedStyle(node.querySelector('.cds--modal-content')).backgroundColor,
  }));
  expect(frame.bodyScroll).toBeLessThanOrEqual(frame.bodyHeight + 1);
  expect(frame.height).toBeLessThan(frame.viewport);
  expect(frame.headerColor).toBe(frame.bodyColor);
  await expect(body.getByText('ガソリン代の金額')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'ガソリン代を適用' })).toBeVisible();
});

test('movement settings keep aligned modal surfaces in both themes', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 852 });
  const roomId = `MOVEMENT-THEMES-${testInfo.project.name}-${testInfo.retry}`;
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: `sanpo-react:v1:${roomId}:room`, value: structuredClone(fixture),
  });
  await page.goto(`/?room=${roomId}&view=seisan`);
  const surfaces = {};

  for (const theme of ['light', 'dark']) {
    await page.evaluate(themePreference => localStorage.setItem('sanpo-react:theme-preference:v1', themePreference), theme);
    await page.reload();
    await page.getByRole('tab', { name: '精算', exact: true }).click();
    await page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) })
      .getByRole('button', { name: /の費用を(?:入力|編集)$/ }).click();
    let dialog = page.getByRole('dialog', { name: /^仮参加者A車：/ });
    await dialog.getByRole('button', { name: 'ガソリン代の計算条件を編集' }).click();
    dialog = page.getByRole('dialog', { name: '仮参加者A車：ガソリン代を設定' });
    surfaces[theme] = await dialog.evaluate(node => {
      const container = node.closest('.cds--modal-container') || node.querySelector('.cds--modal-container');
      const header = node.querySelector('.cds--modal-header');
      const body = node.querySelector('.cds--modal-content');
      const input = node.querySelector('#settlement-distance');
      const preview = node.querySelector('.settlement-movement-preview');
      return {
        container: getComputedStyle(container).backgroundColor,
        header: getComputedStyle(header).backgroundColor,
        body: getComputedStyle(body).backgroundColor,
        input: getComputedStyle(input).backgroundColor,
        preview: getComputedStyle(preview).backgroundColor,
      };
    });
    await expect(dialog.getByRole('button', { name: '戻る' })).toBeVisible();
    await dialog.getByRole('button', { name: '戻る' }).click();
    await page.getByRole('dialog', { name: '仮参加者A車：費用を編集' }).getByRole('button', { name: 'キャンセル' }).click();
  }

  expect(surfaces.light.header).toBe(surfaces.light.body);
  expect(surfaces.dark.header).toBe(surfaces.dark.body);
  expect(surfaces.light.container).not.toBe(surfaces.dark.container);
  expect(surfaces.light.input).not.toBe(surfaces.light.container);
  expect(surfaces.dark.input).not.toBe(surfaces.dark.container);
  expect(surfaces.light.preview).not.toBe(surfaces.light.container);
  expect(surfaces.dark.preview).not.toBe(surfaces.dark.container);
});

test('movement settings scroll only their body at a compact viewport and keep the footer available', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 500 });
  const roomId = `MOVEMENT-SCROLL-${testInfo.project.name}-${testInfo.retry}`;
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: `sanpo-react:v1:${roomId}:room`, value: structuredClone(fixture),
  });
  await page.goto(`/?room=${roomId}&view=seisan`);
  await page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) })
    .getByRole('button', { name: /の費用を(?:入力|編集)$/ }).click();
  let dialog = page.getByRole('dialog', { name: /^仮参加者A車：/ });
  await dialog.getByRole('button', { name: 'ガソリン代の計算条件を編集' }).click();
  dialog = page.getByRole('dialog', { name: '仮参加者A車：ガソリン代を設定' });
  const body = dialog.locator('.cds--modal-content');
  await expect.poll(() => body.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
  await expect(dialog.getByRole('button', { name: 'ガソリン代を適用' })).toBeVisible();
  await body.hover();
  await page.mouse.wheel(0, 1200);
  await expect(body.getByText('ガソリン代の金額')).toBeInViewport();
});

test('Times movement settings keep short content compact', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 852 });
  const roomId = `TIMES-MOVEMENT-${testInfo.project.name}-${testInfo.retry}`;
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: `sanpo-react:v1:${roomId}:room`, value: structuredClone(fixture),
  });
  await page.goto(`/?room=${roomId}&view=seisan`);
  await page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者D車/ }) })
    .getByRole('button', { name: /の費用を(?:入力|編集)$/ }).click();
  let dialog = page.getByRole('dialog', { name: /^仮参加者D車：/ });
  await dialog.getByRole('button', { name: 'タイムズ移動料金の計算条件を編集' }).click();
  dialog = page.getByRole('dialog', { name: '仮参加者D車：タイムズ移動料金を設定' });
  const body = dialog.locator('.cds--modal-content');
  await expect(dialog.getByRole('radio', { name: 'タイムズ' })).toBeChecked();
  await expect.poll(() => body.evaluate(node => node.scrollHeight <= node.clientHeight + 1)).toBe(true);
  await expect(dialog.getByRole('button', { name: 'タイムズ移動料金を適用' })).toBeVisible();
});
