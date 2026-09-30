import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { navigateToProjectSection } from './project-navigation.js';

test('page title is visually distinct from its supporting description', async ({ page }) => {
  await page.goto('/?room=AB-REVIEW-HIERARCHY');
  const title = page.getByRole('heading', { level: 1, name: '参加者', exact: true });
  const description = page.getByRole('main').getByText('応募者を確認し、この企画に参加する人を確定します。', { exact: true });
  const titleSize = await title.evaluate(node => parseFloat(getComputedStyle(node).fontSize));
  const descriptionSize = await description.evaluate(node => parseFloat(getComputedStyle(node).fontSize));
  expect(titleSize).toBeGreaterThan(descriptionSize);
});

test('every published destination has a matching title and current location in both themes', async ({ page }, testInfo) => {
  await page.goto('/?room=AB-REVIEW-DESTINATIONS');
  const navigation = page.getByRole('navigation', { name: '企画内ナビゲーション' });
  const labels = await navigation.getByRole('link').allTextContents();
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') {
      await page.getByRole('button', { name: 'ユーティリティメニュー' }).click();
      await page.getByRole('menuitem', { name: 'ダークモードに切り替え' }).click();
    }
    for (const name of labels) {
      await navigateToProjectSection(page, name);
      const title = page.getByRole('heading', { level: 1, name, exact: true });
      await expect(title).toBeFocused();
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(navigation.getByRole('link', { name, exact: true })).toHaveAttribute('aria-current', 'page');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
  await page.getByRole('button', { name: '履歴を開く', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '履歴', exact: true }).getByRole('button', { name: '現在の状態を保存', exact: true })).toBeVisible();
});

test('legacy car and team links survive refresh and subsequent canonical navigation', async ({ page }) => {
  for (const [allocation, title] of [['car', '車割'], ['team', '班割']]) {
    await page.goto(`/?room=AB-REVIEW-LEGACY&view=sheet&allocation=${allocation}`);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await navigateToProjectSection(page, '参加者');
    await expect(page).toHaveURL(/room=AB-REVIEW-LEGACY&section=participants$/);
  }
});

test('long context and mobile menu remain usable in a short viewport and reduced motion', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?room=AB-REVIEW-LONG&section=overview');
  const longName = '秋季縦走登山安全講習および新入部員歓迎を兼ねた非常に長い企画名と集合時刻の確認';
  await page.getByRole('button', { name: '企画情報を編集', exact: true }).click();
  await page.getByRole('textbox', { name: '企画名' }).fill(longName);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.reload();
  const mobile = testInfo.project.name.includes('mobile');
  await page.setViewportSize({ width: mobile ? 390 : 1280, height: mobile ? 500 : 900 });
  const evidence = process.env.PHASE_AB_EVIDENCE_DIR;
  if (evidence) mkdirSync(evidence, { recursive: true });
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') {
      await page.getByRole('button', { name: 'ユーティリティメニュー' }).click();
      await page.getByRole('menuitem', { name: 'ダークモードに切り替え' }).click();
    }
    await expect(page.getByRole('main').getByText(longName, { exact: true }).first()).toBeVisible();
    if (evidence) await page.screenshot({ path: join(evidence, `${testInfo.project.name}-${theme}-context.png`), animations: 'disabled' });
    if (mobile) {
      const trigger = page.getByRole('button', { name: /企画メニューを/ });
      const bounds = await trigger.boundingBox();
      expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      await trigger.tap();
      const navigation = page.getByRole('navigation', { name: '企画内ナビゲーション' });
      await expect(trigger).toHaveAttribute('aria-controls', await navigation.getAttribute('id'));
      await expect.poll(async () => (await navigation.boundingBox()).x).toBeGreaterThanOrEqual(0);
      if (evidence) await page.screenshot({ path: join(evidence, `${testInfo.project.name}-${theme}-navigation.png`), animations: 'disabled' });
      await navigation.getByRole('link', { name: '履歴', exact: true }).tap();
      await expect(page.getByRole('heading', { level: 1, name: '履歴', exact: true })).toBeFocused();
      await navigateToProjectSection(page, '概要');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
