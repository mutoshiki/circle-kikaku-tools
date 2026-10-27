import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expectFontsLoaded } from './font-readiness.js';

test('project name action says set before a name exists and change afterward', async ({ page }) => {
  await page.goto('/?room=REACT-NAME-ACTION');
  const action = page.getByRole('button', { name: '企画名を設定', exact: true });
  await expect(action).toBeVisible();
  await expect(action).toHaveText('企画名を設定');
  await action.click();
  await page.getByRole('textbox', { name: '企画名' }).fill('企画名あり');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  const rename = page.getByRole('button', { name: '企画名を変更', exact: true });
  await expect(rename).toBeVisible();
  await expect(rename).toHaveText('変更');
});

test('Carbon sync status styles keep normal confirmation quiet and actionable states readable', async ({ page }) => {
  await page.goto('/?room=REACT-SYNC-TYPOGRAPHY');
  await page.locator('#project-heading').waitFor();
  await page.evaluate(() => {
    const compact = document.createElement('span');
    compact.id = 'sync-status-compact-test';
    compact.className = 'sync-status sync-status--compact';
    compact.setAttribute('role', 'status');
    compact.textContent = '同期完了';
    const prominent = document.createElement('span');
    prominent.id = 'sync-status-prominent-test';
    prominent.className = 'sync-status sync-status--prominent';
    prominent.setAttribute('role', 'status');
    prominent.textContent = '同期に失敗しました。再接続してください。';
    document.querySelector('#project-heading').parentElement.append(compact, prominent);
  });
  await expect(page.locator('#sync-status-compact-test')).toHaveCSS('font-size', '12px');
  expect(await page.locator('#sync-status-compact-test').evaluate(element => Number.parseFloat(getComputedStyle(element).lineHeight))).toBeCloseTo(16, 0);
  await expect(page.locator('#sync-status-prominent-test')).toHaveCSS('font-size', '14px');
  expect(await page.locator('#sync-status-prominent-test').evaluate(element => Number.parseFloat(getComputedStyle(element).lineHeight))).toBeCloseTo(18, 0);
  await expect(page.locator('#sync-status-compact-test')).toHaveAttribute('role', 'status');
  await expect(page.locator('#sync-status-prominent-test')).toHaveAttribute('role', 'status');
});

test('independent shell: semantic header utilities, related apps, Japanese input, themes and no legacy runtime', async ({ page }, testInfo) => {
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  await page.goto('/?room=REACT-FIXTURE');
  await expect(page).toHaveTitle('サークル企画ツール');
  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'メインコンテンツへ移動', exact: true });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toHaveAttribute('href', '#main-content');
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  await expect(page.getByRole('button', { name: '企画のリンクをコピー', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'その他の操作', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '関連アプリ', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /ナビゲーションを/ })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: '山歩会ツール', exact: true })).toHaveCount(0);
  await expect(page.getByText('ローカル保存', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'その他の操作', exact: true }).click();
  const utilities = page.getByRole('menu', { name: 'その他の操作', exact: true });
  await expect(utilities.getByRole('menuitem', { name: '使い方', exact: true })).toBeVisible();
  await expect(utilities.getByRole('menuitem', { name: 'サンプルデータ', exact: true })).toBeVisible();
  await expect(utilities.getByRole('menuitem', { name: 'ダークモードに切り替え', exact: true })).toBeVisible();
  await expect(utilities.getByRole('menuitem', { name: 'バグを報告する', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(utilities).toBeHidden();
  await page.getByRole('button', { name: '関連アプリ', exact: true }).click();
  const applications = page.getByRole('navigation', { name: '関連アプリ', exact: true });
  await expect(applications.getByRole('link', { name: '山歩会フォームメーカー', exact: true })).toHaveAttribute('href', 'https://mutoshiki.github.io/sanpokai-kikaku-portal/form-maker/');
  await expect(applications.getByRole('link', { name: '学務提出書類作成ツール', exact: true })).toHaveAttribute('href', /sampokai-submission-builder/);
  await expect(applications.getByRole('link', { name: '山歩会企画ツール一覧', exact: true })).toHaveAttribute('href', /sanpokai-kikaku-portal/);
  await page.getByRole('button', { name: '関連アプリ', exact: true }).click();
  await expect(page.getByRole('tab')).toHaveText(['参加者', '車割', '班割', '精算']);
  await page.getByRole('button', { name: '企画名を設定' }).click();
  const projectName = page.getByRole('textbox', { name: '企画名' });
  await projectName.fill('互換性確認用の企画');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('#project-heading')).toHaveText('互換性確認用の企画');
  await expect(page.getByRole('button', { name: '企画名を変更' })).toBeFocused();
  const initialHeadings = { '参加者': '参加者を登録して始める', '車割': '車割を始める', '班割': '班割を始める', '精算': '精算を始める' };
  for (const name of ['参加者', '車割', '班割', '精算']) {
    await page.getByRole('tab', { name, exact: true }).click();
    await expect(page.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel').getByRole('heading', { name: initialHeadings[name], exact: true })).toBeVisible();
  }
  for (const theme of ['g10', 'g100']) {
    if (theme === 'g100') { await page.getByRole('button', { name: 'その他の操作' }).click(); await page.getByRole('menuitem', { name: 'ダークモードに切り替え' }).click(); }
    await expect(page.locator('.application')).toHaveClass(new RegExp(`cds--${theme}(?:\\s|$)`));
    await page.getByRole('button', { name: '企画名を変更' }).click();
    await expect(page.getByRole('textbox', { name: '企画名' })).toHaveCSS('background-color', theme === 'g100' ? 'rgb(57, 57, 57)' : 'rgb(255, 255, 255)');
    await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expectFontsLoaded(page);
    await page.screenshot({ path: join(process.env.MIGRATION_EVIDENCE_DIR || join(tmpdir(), 'circle-react-migration-evidence'), `shell-${testInfo.project.name}-${theme}.png`) });
  }
  expect(await page.evaluate(() => !!window.SanpoCanonicalState || !!customElements.get('cds-button'))).toBe(false);
  expect(requests.filter(url => /firebaseio|firebase-config|assets\/js\/|gstatic/.test(url))).toEqual([]);
  expect(errors).toEqual([]);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
});

test('project name editing does not save on blur and cancel discards the draft', async ({ page }) => {
  await page.goto('/?room=REACT-NAME-EDIT');
  const title = page.locator('#project-heading');
  await expect(title).toHaveText('企画名未設定');
  await page.getByRole('button', { name: '企画名を設定' }).click();
  const field = page.getByRole('textbox', { name: '企画名' });
  await field.fill('取消する名前');
  await page.getByRole('tab', { name: '参加者', exact: true }).click();
  await expect(title).toHaveText('企画名未設定');
  await expect(field).toHaveValue('取消する名前');
  await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await expect(title).toHaveText('企画名未設定');
  await expect(page.getByRole('button', { name: '企画名を設定' })).toBeFocused();
  await page.reload();
  await expect(title).toHaveText('企画名未設定');
});

test('project name Enter and Escape do not interrupt Japanese composition', async ({ page }) => {
  await page.goto('/?room=REACT-NAME-IME');
  await page.getByRole('button', { name: '企画名を設定' }).click();
  const field = page.getByRole('textbox', { name: '企画名' });
  await field.dispatchEvent('compositionstart');
  await field.fill('変換中');
  await field.press('Enter');
  await expect(field).toBeVisible();
  await field.press('Escape');
  await expect(field).toBeVisible();
  await field.dispatchEvent('compositionend', { data: '変換中' });
  await field.press('Escape');
  await expect(page.locator('#project-heading')).toHaveText('企画名未設定');
  await expect(field).toHaveCount(0);
});

test('long project names wrap at phone widths without horizontal page scrolling', async ({ page }) => {
  await page.goto('/?room=REACT-NAME-LAYOUT');
  await page.getByRole('button', { name: '企画名を設定' }).click();
  const titleText = '秋名山登山企画'.repeat(8);
  await page.getByRole('textbox', { name: '企画名' }).fill(titleText);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('#project-heading')).toHaveText(titleText);
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.getByRole('button', { name: '企画名を変更' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width < 672) {
      expect(await page.locator('.project-title').evaluate(element => getComputedStyle(element).paddingBlockStart)).toBe('16px');
      const heading = page.locator('#project-heading');
      const lineHeight = Number.parseFloat(await heading.evaluate(element => getComputedStyle(element).lineHeight));
      expect((await heading.boundingBox()).height).toBeGreaterThan(lineHeight);
    }
  }
});

test('sample menu keeps the legacy form-linked sample action', async ({ page }) => {
  await page.goto('/?room=REACT-FORM-SAMPLE');
  await page.getByRole('button', { name: 'その他の操作' }).click();
  await page.getByRole('menuitem', { name: 'サンプルデータ' }).click();
  const dialog = page.getByRole('dialog', { name: 'サンプルデータ' });
  await expect(dialog.getByRole('radio', { name: 'フォーム連携のサンプル' })).toBeVisible();
  await dialog.getByRole('radio', { name: 'フォーム連携のサンプル' }).check({ force: true });
  await dialog.getByRole('button', { name: 'サンプルに置き換える' }).click();
  await expect(page.getByText('フォーム連携のサンプルに置き換えました。')).toBeVisible();
  await expect(page.locator('#project-heading')).toHaveText('フォーム連携テスト企画');
  await page.getByRole('tab', { name: '参加者', exact: true }).click();
  await expect(page.getByText(/応募者 5人/)).toBeVisible();
  await expect(page.getByText('参加者確定後', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '発表文を作成', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '引き継ぎデータを作成', exact: true })).toBeVisible();
});
