import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expectFontsLoaded } from './font-readiness.js';

async function openProjectNameEditor(page) {
  await page.getByRole('button', { name: 'その他の操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '企画名を変更', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '企画名' })).toBeFocused();
}

test('project name is shown in the header and renamed from the overflow menu', async ({ page }) => {
  await page.goto('/?room=REACT-NAME-ACTION');
  await expect(page.locator('.app-header .cds--header__name')).toContainText('企画名未設定');
  await expect(page.getByRole('button', { name: '企画一覧へ' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '変更', exact: true })).toHaveCount(0);
  await openProjectNameEditor(page);
  await page.getByRole('textbox', { name: '企画名' }).fill('企画名あり');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('.app-header .cds--header__name')).toContainText('企画名あり');
});

test('normal sync and save states do not occupy a status row', async ({ page }) => {
  await page.goto('/?room=REACT-SYNC-TYPOGRAPHY');
  await page.locator('#project-heading').waitFor();
  await expect(page.locator('.project-sync-status')).toHaveCount(0);
  await expect(page.getByText('同期完了', { exact: true })).toHaveCount(0);
});

test('independent shell: overflow menu, project navigation, Japanese input, themes and no legacy runtime', async ({ page }, testInfo) => {
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
  await expect(page.getByRole('button', { name: 'その他の操作', exact: true })).toHaveAttribute('aria-haspopup', 'menu');
  await expect(page.getByRole('button', { name: 'その他の操作', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('button', { name: '関連アプリ', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /ナビゲーションを/ })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: '山歩会ツール', exact: true })).toHaveCount(0);
  await expect(page.getByText('ローカル保存', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'その他の操作', exact: true }).click();
  const utilities = page.getByRole('menu', { name: 'その他の操作', exact: true });
  await expect(page.getByRole('button', { name: 'その他の操作', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await expect(utilities.getByRole('menuitem', { name: '使い方', exact: true })).toBeVisible();
  await expect(utilities.getByRole('menuitem', { name: 'サンプルデータ', exact: true })).toBeVisible();
  await expect(utilities.getByRole('menuitem', { name: '不具合を報告', exact: true })).toBeVisible();
  await expect(utilities.getByRole('menuitem')).toHaveText([
    '企画一覧へ', '企画名を変更', 'タブを編集', '使い方', '不具合を報告',
    'サンプルデータ', '山歩会フォームメーカー（外部ツール）', '学務提出書類作成ツール（外部ツール）',
  ]);
  await expect(utilities.getByRole('separator')).toHaveCount(2);
  await expect(utilities.getByRole('menuitem', { name: /テーマ|表示設定/ })).toHaveCount(0);
  await expect(utilities.getByRole('menuitem', { name: '企画一覧へ' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(utilities.getByRole('menuitem', { name: '企画名を変更' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(utilities).toBeHidden();
  await expect(page.getByRole('button', { name: 'その他の操作', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'その他の操作', exact: true }).click();
  await page.locator('#main-content').click({ position: { x: 8, y: 8 } });
  await expect(utilities).toBeHidden();
  await page.evaluate(() => {
    window.__openedExternalTools = [];
    window.open = (url, target, features) => { window.__openedExternalTools.push({ url, target, features }); return null; };
  });
  await page.getByRole('button', { name: 'その他の操作', exact: true }).click();
  await utilities.getByRole('menuitem', { name: '山歩会フォームメーカー（外部ツール）', exact: true }).click();
  await expect(utilities).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__openedExternalTools)).toEqual([{
    url: 'https://mutoshiki.github.io/sanpokai-kikaku-portal/form-maker/', target: '_blank', features: 'noopener,noreferrer',
  }]);
  await page.getByRole('button', { name: 'その他の操作', exact: true }).click();
  await utilities.getByRole('menuitem', { name: '学務提出書類作成ツール（外部ツール）', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__openedExternalTools.at(-1))).toEqual({
    url: 'https://github.com/mutoshiki/sampokai-submission-builder/releases', target: '_blank', features: 'noopener,noreferrer',
  });
  await page.getByRole('button', { name: 'その他の操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '企画一覧へ', exact: true }).click();
  await expect(page.getByRole('heading', { name: '企画一覧', exact: true })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(0);
  expect(page.context().pages()).toHaveLength(1);
  await page.goto('/?room=REACT-FIXTURE');
  await expect(page.getByRole('tab')).toHaveText(['参加者', '車割', '班割', '精算']);
  await openProjectNameEditor(page);
  const projectName = page.getByRole('textbox', { name: '企画名' });
  await projectName.fill('互換性確認用の企画');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('#project-heading')).toHaveText('互換性確認用の企画');
  await expect(page.locator('.app-header .cds--header__name')).toContainText('互換性確認用の企画');
  await expect(page.getByRole('button', { name: 'その他の操作' })).toBeFocused();
  const initialHeadings = { '参加者': '参加者が登録されていません', '車割': '車割', '班割': '班割', '精算': '精算' };
  for (const name of ['参加者', '車割', '班割', '精算']) {
    await page.getByRole('tab', { name, exact: true }).click();
    await expect(page.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel').getByRole('heading', { name: initialHeadings[name], exact: true })).toBeVisible();
  }
  for (const theme of ['g10', 'g100']) {
    await page.emulateMedia({ colorScheme: theme === 'g100' ? 'dark' : 'light' });
    await expect(page.locator('.application')).toHaveClass(new RegExp(`cds--${theme}(?:\\s|$)`));
    await openProjectNameEditor(page);
    await expect(page.getByRole('textbox', { name: '企画名' })).toHaveCSS('background-color', theme === 'g100' ? 'rgb(57, 57, 57)' : 'rgb(244, 244, 244)');
    await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expectFontsLoaded(page);
    await page.screenshot({ path: join(process.env.MIGRATION_EVIDENCE_DIR || join(tmpdir(), 'circle-react-migration-evidence'), `shell-${testInfo.project.name}-${theme}.png`) });
  }
  await page.getByRole('button', { name: 'その他の操作' }).click();
  await page.getByRole('menuitem', { name: 'タブを編集', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'タブを編集', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '企画へ戻る', exact: true }).click();
  await expect(page.getByRole('tab', { name: '精算', exact: true })).toHaveAttribute('aria-selected', 'true');
  expect(await page.evaluate(() => !!window.SanpoCanonicalState || !!customElements.get('cds-button'))).toBe(false);
  expect(requests.filter(url => /firebaseio|firebase-config|assets\/js\/|gstatic/.test(url))).toEqual([]);
  expect(errors).toEqual([]);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
});

test('project name cancel discards the draft', async ({ page }) => {
  await page.goto('/?room=REACT-NAME-EDIT');
  const title = page.locator('#project-heading');
  await expect(title).toHaveText('企画名未設定');
  await openProjectNameEditor(page);
  const field = page.getByRole('textbox', { name: '企画名' });
  await field.fill('取消する名前');
  await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await expect(title).toHaveText('企画名未設定');
  await expect(page.getByRole('button', { name: 'その他の操作' })).toBeFocused();
  await page.reload();
  await expect(title).toHaveText('企画名未設定');
});

test('project name Enter and Escape do not interrupt Japanese composition', async ({ page }) => {
  await page.goto('/?room=REACT-NAME-IME');
  await openProjectNameEditor(page);
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
  await openProjectNameEditor(page);
  const titleText = '秋名山登山企画'.repeat(8);
  await page.getByRole('textbox', { name: '企画名' }).fill(titleText);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('#project-heading')).toHaveText(titleText);
  await expect(page.locator('.app-header .cds--header__name')).toContainText(titleText);
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.locator('.app-header .cds--header__name')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width < 672) {
      expect(await page.locator('.app-header .cds--header__name').evaluate(element => getComputedStyle(element).overflow)).toBe('hidden');
    }
    if (width === 390 || width === 1280) {
      const titleWidth = await page.locator('.app-header__project-name').evaluate(element => element.getBoundingClientRect().width);
      expect(titleWidth).toBeGreaterThan(width === 390 ? 200 : 450);
      await page.getByRole('button', { name: 'その他の操作', exact: true }).click();
      expect(await page.evaluate(() => window.scrollX)).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const popover = page.locator('.utility-menu-popover__content');
      const bounds = await popover.evaluate(element => {
        const { left, right, top, bottom } = element.getBoundingClientRect();
        return { left, right, top, bottom, width: innerWidth, height: innerHeight };
      });
      expect(bounds.left).toBeGreaterThanOrEqual(0);
      expect(bounds.right).toBeLessThanOrEqual(bounds.width);
      expect(bounds.top).toBeGreaterThanOrEqual(0);
      expect(bounds.bottom).toBeLessThanOrEqual(bounds.height);
      await page.keyboard.press('Escape');
    }
  }
});

test('sample menu keeps the legacy form-linked sample action', async ({ page }) => {
  await page.goto('/?room=REACT-FORM-SAMPLE');
  await expect(page.getByRole('button', { name: '企画のリンクをコピー', exact: true })).toBeVisible();
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
  await expect(page.getByRole('button', { name: '学務書類用CSVを作成', exact: true })).toBeVisible();
  await page.goto('/?debugSample=all-tools&view=participants&room=DEBUG-SHELL-SAMPLE');
  await expect(page.getByRole('button', { name: '企画のリンクをコピー', exact: true })).toHaveCount(0);
});
