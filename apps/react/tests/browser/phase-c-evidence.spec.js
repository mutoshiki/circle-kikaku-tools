import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const evidenceRoot = process.env.PHASE_C_EVIDENCE_DIR;

test('Phase C page-form contract is responsive, keyboard ordered, dark-theme safe, and reduced-motion safe', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const roomId = `PHASE-C-EVIDENCE-${testInfo.project.name}`;
  await page.goto(`/?room=${roomId}&section=overview`);

  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: '概要' })).toBeVisible();
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);

  await page.getByRole('button', { name: '企画情報を編集', exact: true }).click();
  const name = page.getByRole('textbox', { name: '企画名', exact: true });
  const memo = page.getByRole('textbox', { name: 'メモ', exact: true });
  await expect(name).toBeFocused();
  await name.fill('秋の安全登山計画・長い企画名でも現在の企画contextとpage actionが水平方向に溢れないことを確認する');
  await page.keyboard.press('Tab');
  await expect(memo).toBeFocused();
  await memo.fill('共有前の下書き。保存するまでは他のユーザーへ反映されません。');
  await expect(page.getByText('未保存の変更', { exact: true })).toBeVisible();

  const actions = page.locator('.overview-editor__actions');
  await expect(actions.getByRole('button', { name: '保存', exact: true })).toBeVisible();
  await expect(actions.getByRole('button', { name: 'キャンセル', exact: true })).toBeVisible();
  if (testInfo.project.name.includes('mobile')) {
    const heights = await page.getByRole('form', { name: '企画情報を編集', exact: true }).getByRole('button').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(40);
  }

  await page.getByRole('button', { name: 'ユーティリティメニュー' }).click();
  await page.getByRole('menuitem', { name: 'ダークモードに切り替え' }).click();
  await expect(page.locator('.application')).toHaveClass(/cds--g100/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  if (evidenceRoot) {
    mkdirSync(evidenceRoot, { recursive: true });
    await page.screenshot({ path: join(evidenceRoot, `phase-c-${testInfo.project.name}-overview-edit-dark.png`), fullPage: true });
  }

  await actions.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('button', { name: '企画情報を編集', exact: true })).toBeFocused();
  await expect(page.getByText('共有前の下書き。保存するまでは他のユーザーへ反映されません。', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
