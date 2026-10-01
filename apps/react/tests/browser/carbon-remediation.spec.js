import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { navigateToProjectSection } from './project-navigation.js';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/legacy-v4.json', import.meta.url)));

test.beforeEach(async ({ page }, testInfo) => {
  const roomId = `CARBON-${testInfo.project.name}-${testInfo.retry}`;
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: `sanpo-react:v1:${roomId}:room`, value: fixture,
  });
  await page.goto(`/?room=${roomId}`);
});

test('shared Carbon layout, contextual feedback, icon labels and mobile overflow', async ({ page }) => {
  await expect(page.getByRole('banner')).toHaveCount(1);
  await expect(page.getByRole('navigation', { name: '企画内ナビゲーション' })).toHaveCount(1);
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await navigateToProjectSection(page, '車割');
  await page.getByRole('link', { name: '仮参加者A車の詳細', exact: true }).click();
  await page.getByRole('button', { name: '仮参加者Bの操作', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: '固定を解除', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: '車割に戻る', exact: true }).click();
  await expect(page.getByRole('button', { name: /の操作$/ }).first()).toBeVisible();
  const add = page.getByRole('button', { name: '車を追加', exact: true });
  if (await add.count()) {
    await add.click();
    const dialog = page.getByRole('dialog', { name: '車を追加' });
    if (await dialog.count()) await dialog.getByRole('button', { name: 'キャンセル' }).click();
    else {
      await expect(page.getByRole('status').filter({ hasText: '未割り当ての参加者を選ぶと車を追加できます。' })).toBeVisible();
      await expect(page.locator('.notification-region')).toHaveCount(0);
      await navigateToProjectSection(page, '精算');
      await expect(page.getByText('未割り当ての参加者を選ぶと車を追加できます。')).toBeHidden();
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('participant registration scrolls as a page with reachable actions and no horizontal overflow', async ({ page }) => {
  await page.goto('/?room=CARBON-EMPTY-REGISTRATION');
  await navigateToProjectSection(page, '参加者');
  await page.getByRole('button', { name: '参加者を追加', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: '参加者を登録' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const submit = page.getByRole('form', { name: '参加者を登録' }).getByRole('button', { name: '参加者を登録', exact: true });
  await submit.scrollIntoViewIfNeeded();
  const geometry = await submit.evaluate(node => ({ bottom: node.getBoundingClientRect().bottom, viewport: innerHeight, width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewport);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width);
});
