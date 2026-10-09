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
    .getByRole('button', { name: '費用を入力', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: '仮参加者A車' });
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
    .getByRole('button', { name: '費用を入力', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: '仮参加者A車' });
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
