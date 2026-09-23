import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expectFontsLoaded } from './font-readiness.js';

test('independent shell: semantic header utilities, related apps, Japanese input, themes and no legacy runtime', async ({ page }, testInfo) => {
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  await page.goto('/?room=REACT-FIXTURE');
  await expect(page).toHaveTitle('サークル企画ツール');
  await expect(page.getByRole('button', { name: '共有リンク', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ユーティリティメニュー', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '関連アプリ', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /ナビゲーションを/ })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: '山歩会ツール', exact: true })).toHaveCount(0);
  await expect(page.getByText('ローカル保存', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'ユーティリティメニュー', exact: true }).click();
  const utilities = page.getByRole('menu', { name: 'ユーティリティメニュー', exact: true });
  await expect(utilities.getByRole('menuitem', { name: '使い方', exact: true })).toBeVisible();
  await expect(utilities.getByRole('menuitem', { name: 'サンプルデータ', exact: true })).toBeVisible();
  await expect(utilities.getByRole('menuitem', { name: 'ダークモードに切り替え', exact: true })).toBeVisible();
  await expect(utilities.getByRole('menuitem', { name: 'バグを報告する', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(utilities).toBeHidden();
  await page.getByRole('button', { name: '関連アプリ', exact: true }).click();
  const applications = page.getByRole('navigation', { name: '関連アプリ', exact: true });
  await expect(applications.getByRole('link', { name: '山歩会フォームメーカー', exact: true })).toHaveAttribute('href', /script\.google\.com/);
  await expect(applications.getByRole('link', { name: '学務提出書類作成ツール', exact: true })).toHaveAttribute('href', /sampokai-submission-builder/);
  await expect(applications.getByRole('link', { name: '山歩会企画ツール一覧', exact: true })).toHaveAttribute('href', /sanpokai-kikaku-portal/);
  await page.getByRole('button', { name: '関連アプリ', exact: true }).click();
  await expect(page.getByRole('tab')).toHaveText(['参加者', '車割', '班割', '精算']);
  await page.getByRole('textbox', { name: '企画名' }).fill('互換性確認用の企画');
  for (const name of ['参加者', '車割', '班割', '精算']) {
    await page.getByRole('tab', { name, exact: true }).click();
    await expect(page.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel')).toContainText('参加者がいません');
  }
  for (const theme of ['g10', 'g100']) {
    if (theme === 'g100') { await page.getByRole('button', { name: 'ユーティリティメニュー' }).click(); await page.getByRole('menuitem', { name: 'ダークモードに切り替え' }).click(); }
    await expect(page.locator('.application')).toHaveClass(new RegExp(`cds--${theme}(?:\\s|$)`));
    await expect(page.getByRole('textbox', { name: '企画名' })).toHaveCSS('background-color', theme === 'g100' ? 'rgb(38, 38, 38)' : 'rgb(255, 255, 255)');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expectFontsLoaded(page);
    await page.screenshot({ path: join(process.env.MIGRATION_EVIDENCE_DIR || join(tmpdir(), 'circle-react-migration-evidence'), `shell-${testInfo.project.name}-${theme}.png`) });
  }
  expect(await page.evaluate(() => !!window.SanpoCanonicalState || !!customElements.get('cds-button'))).toBe(false);
  expect(requests.filter(url => /firebaseio|firebase-config|assets\/js\/|gstatic/.test(url))).toEqual([]);
  expect(errors).toEqual([]);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
});

test('sample menu keeps the legacy form-linked sample action', async ({ page }) => {
  await page.goto('/?room=REACT-FORM-SAMPLE');
  await page.getByRole('button', { name: 'ユーティリティメニュー' }).click();
  await page.getByRole('menuitem', { name: 'サンプルデータ' }).click();
  const dialog = page.getByRole('dialog', { name: 'サンプルデータ' });
  await expect(dialog.getByRole('radio', { name: 'フォーム連携サンプル' })).toBeVisible();
  await dialog.getByRole('radio', { name: 'フォーム連携サンプル' }).check({ force: true });
  await dialog.getByRole('button', { name: 'サンプルを入れる' }).click();
  await expect(page.getByText('フォーム連携サンプルを入れました')).toBeVisible();
  await expect(page.getByRole('textbox', { name: '企画名' })).toHaveValue('フォーム連携テスト企画');
  await page.getByRole('tab', { name: '参加者', exact: true }).click();
  await expect(page.getByText(/応募者 5人/)).toBeVisible();
  await expect(page.getByText('参加者確定後', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '発表文を作成', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '引き継ぎデータを作成', exact: true })).toBeVisible();
});
