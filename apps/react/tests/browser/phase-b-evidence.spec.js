import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { navigateToProjectSection } from './project-navigation.js';

const evidenceRoot = process.env.PHASE_B_EVIDENCE_DIR;

test('capture Phase B shell evidence', async ({ page }, testInfo) => {
  test.skip(!evidenceRoot, 'evidence capture is opt-in');
  mkdirSync(evidenceRoot, { recursive: true });
  const roomId = `PHASE-B-EVIDENCE-${testInfo.project.name}`;
  await page.goto(`/?room=${roomId}&section=overview`);
  await page.getByRole('button', { name: 'ユーティリティメニュー' }).click();
  await page.getByRole('menuitem', { name: 'サンプルデータ', exact: true }).click();
  const sample = page.getByRole('dialog', { name: 'サンプルデータ' });
  await sample.getByRole('radio', { name: '通常サンプル', exact: true }).check({ force: true });
  await sample.getByRole('button', { name: 'サンプルを入れる', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: '概要' })).toBeVisible();
  await page.screenshot({ path: join(evidenceRoot, `after-${testInfo.project.name}-overview-light.png`), fullPage: true });

  if (testInfo.project.name.includes('mobile')) {
    await page.getByRole('button', { name: '企画メニューを開く' }).click();
    const navigation = page.getByRole('navigation', { name: '企画内ナビゲーション' });
    await expect(navigation).toBeVisible();
    await expect
      .poll(async () => (await navigation.boundingBox())?.width ?? 0)
      .toBeGreaterThanOrEqual(255);
    await expect
      .poll(async () => (await page.getByRole('main').boundingBox())?.x ?? -1)
      .toBe(0);
    await page.screenshot({ path: join(evidenceRoot, `after-${testInfo.project.name}-navigation-open.png`) });
    await page.getByRole('button', { name: '企画メニューを閉じる' }).click();
  }

  await navigateToProjectSection(page, '参加者');
  await page.getByRole('button', { name: 'ユーティリティメニュー' }).click();
  await page.getByRole('menuitem', { name: 'ダークモードに切り替え' }).click();
  await expect(page.locator('.application')).toHaveClass(/cds--g100/);
  await page.screenshot({ path: join(evidenceRoot, `after-${testInfo.project.name}-participants-dark.png`), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
