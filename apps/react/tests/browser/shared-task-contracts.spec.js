import { test, expect } from '@playwright/test';
import { navigateToProjectSection } from './project-navigation.js';

test('visible participant state changes do not add redundant success toasts', async ({ page }) => {
  await page.goto('/?room=PHASE-C-TYPED-NOTICE&section=participants');
  await page.getByRole('button', { name: '追加', exact: true }).click();
  const registration = page.getByRole('dialog', { name: '参加者登録' });
  await registration.getByRole('textbox', { name: '参加者（改行区切り）', exact: true }).fill('通知契約 参加者');
  await registration.getByRole('button', { name: '登録', exact: true }).click();
  await page.waitForTimeout(100);
  expect(await page.locator('.cds--toast-notification').count()).toBe(0);
  const row = page.locator('.participant-row').filter({ hasText: '通知契約 参加者' });
  await expect(row).toBeVisible();

  await row.getByRole('button', { name: '通知契約 参加者の操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '編集', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '参加者を編集' });
  await editor.getByRole('textbox', { name: '名前', exact: true }).fill('通知契約 更新後');
  await editor.getByRole('button', { name: '保存', exact: true }).click();
  await page.waitForTimeout(100);
  expect(await page.locator('.cds--toast-notification').count()).toBe(0);
  await expect(page.locator('.participant-row').filter({ hasText: '通知契約 更新後' })).toBeVisible();
});

test('clipboard result uses an explicit transient feedback surface', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async value => { window.__copiedShareUrl = value; } },
    });
  });
  await page.goto('/?room=PHASE-C-CLIPBOARD&section=overview');
  await page.getByRole('button', { name: '共有リンク', exact: true }).click();
  await expect(page.getByText('リンクをコピーしました', { exact: true })).toBeVisible();
  await expect(page.locator('.cds--toast-notification--success')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__copiedShareUrl)).toContain('room=PHASE-C-CLIPBOARD');
  await navigateToProjectSection(page, '参加者');
});
