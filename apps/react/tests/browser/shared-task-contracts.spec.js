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

test('overview uses an explicit page draft with save, cancel and focus return', async ({ page }) => {
  const roomId = 'PHASE-C-OVERVIEW-PILOT';
  const storageKey = `sanpo-react:v1:${roomId}:room`;
  await page.goto(`/?room=${roomId}&section=overview`);

  const edit = page.getByRole('button', { name: '企画情報を編集', exact: true });
  await expect(edit).toBeVisible();
  await expect(page.getByRole('textbox', { name: '企画名', exact: true })).toHaveCount(0);
  await edit.click();
  await expect(page.getByRole('heading', { level: 2, name: '企画情報を編集', exact: true })).toBeVisible();

  const name = page.getByRole('textbox', { name: '企画名', exact: true });
  await name.fill('保存前の企画名');
  await name.blur();
  await expect(page.getByText('未保存の変更', { exact: true })).toBeVisible();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null')?.roomName, storageKey)).not.toBe('保存前の企画名');

  await navigateToProjectSection(page, '参加者');
  await navigateToProjectSection(page, '概要');
  await expect(page.getByRole('textbox', { name: '企画名', exact: true })).toHaveValue('保存前の企画名');

  await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await expect(edit).toBeFocused();
  await expect(page.getByText('保存前の企画名', { exact: true })).toHaveCount(0);

  await edit.click();
  await page.getByRole('textbox', { name: '企画名', exact: true }).fill('共有保存した企画');
  await page.getByRole('textbox', { name: 'メモ', exact: true }).fill('共有する企画メモ');
  await page.getByRole('textbox', { name: '時刻', exact: true }).fill('08:30');
  await page.getByRole('textbox', { name: '内容', exact: true }).fill('集合');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('共有保存した企画', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('共有する企画メモ', { exact: true })).toBeVisible();
  await expect(page.getByText('08:30', { exact: true })).toBeVisible();
  await expect(page.locator('.cds--toast-notification')).toHaveCount(0);

  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(saved.roomName).toBe('共有保存した企画');
  expect(saved.overview).toEqual({ memo: '共有する企画メモ', timetableItems: [{ time: '08:30', title: '集合' }] });
  await page.reload();
  await expect(page.getByRole('button', { name: '企画情報を編集', exact: true })).toBeVisible();
  await expect(page.getByText('共有する企画メモ', { exact: true })).toBeVisible();
});

test('short participant edit focuses the invalid field and returns focus on dismiss', async ({ page }) => {
  await page.goto('/?room=PHASE-C-MODAL-FOCUS&section=participants');
  await page.getByRole('button', { name: '追加', exact: true }).click();
  const registration = page.getByRole('dialog', { name: '参加者登録' });
  await registration.getByRole('textbox', { name: '参加者（改行区切り）', exact: true }).fill('Focus Contract');
  await registration.getByRole('button', { name: '登録', exact: true }).click();

  const trigger = page.getByRole('button', { name: 'Focus Contractの操作', exact: true });
  await trigger.click();
  await page.getByRole('menuitem', { name: '編集', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '参加者を編集' });
  const name = editor.getByRole('textbox', { name: '名前', exact: true });
  await name.fill('');
  await editor.getByRole('button', { name: '保存', exact: true }).click();
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await expect(name).toBeFocused();
  await expect(editor.getByText('名前を入力してください。', { exact: true }).first()).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(editor).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.getByRole('menuitem', { name: '削除', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: '参加者を削除しますか？' });
  await expect(confirmation.getByText(/車割・班割・精算/)).toBeVisible();
  await confirmation.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await expect(page.getByText('Focus Contract', { exact: true }).first()).toBeVisible();
});
