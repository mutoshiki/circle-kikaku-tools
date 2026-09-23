import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/legacy-v4.json', import.meta.url)));

test.beforeEach(async ({ page }, testInfo) => {
  const roomId = `CARBON-${testInfo.project.name}-${testInfo.retry}`;
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: `sanpo-react:v1:${roomId}:room`, value: fixture,
  });
  await page.goto(`/?room=${roomId}`);
});

test('shared Carbon layout, contextual feedback, icon labels and mobile overflow', async ({ page }) => {
  await expect(page.locator('.project-grid')).toHaveCount(1);
  await expect(page.locator('.content-grid')).toHaveCount(1);
  await page.getByRole('tab', { name: '車割', exact: true }).click();
  await expect(page.getByRole('button', { name: /の固定/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /の操作$/ }).first()).toBeVisible();
  const add = page.getByRole('button', { name: '車を追加', exact: true });
  if (await add.count()) {
    await add.click();
    const dialog = page.getByRole('dialog', { name: '車を追加' });
    if (await dialog.count()) await dialog.getByRole('button', { name: 'キャンセル' }).click();
    else {
      await expect(page.getByRole('status').filter({ hasText: '未割り当ての参加者を選ぶと車を追加できます。' })).toBeVisible();
      await expect(page.locator('.notification-region')).toHaveCount(0);
      await page.getByRole('tab', { name: '精算', exact: true }).click();
      await expect(page.getByText('未割り当ての参加者を選ぶと車を追加できます。')).toBeHidden();
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('long transactional modal keeps its footer in the viewport', async ({ page }) => {
  await page.goto('/?room=CARBON-EMPTY-REGISTRATION');
  await page.getByRole('tab', { name: '参加者', exact: true }).click();
  await page.getByRole('button', { name: '追加', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '参加者登録' });
  await expect(dialog).toBeVisible();
  const geometry = await dialog.evaluate(node => {
    const body = node.querySelector('.cds--modal-content');
    const footer = node.querySelector('.cds--modal-footer');
    const container = node.closest('.cds--modal-container') || document.querySelector('.cds--modal-container');
    return { bodyOverflowY: getComputedStyle(body).overflowY, footerBottom: footer.getBoundingClientRect().bottom, viewport: innerHeight, container: { rect: container.getBoundingClientRect().toJSON(), maxBlockSize: getComputedStyle(container).maxBlockSize, boxSizing: getComputedStyle(container).boxSizing, scrollHeight: container.scrollHeight, clientHeight: container.clientHeight } };
  });
  expect(['auto', 'scroll']).toContain(geometry.bodyOverflowY);
  expect(geometry.footerBottom, JSON.stringify(geometry)).toBeLessThanOrEqual(geometry.viewport);
});
