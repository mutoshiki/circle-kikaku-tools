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
  await expect(page.getByRole('main').getByText('共有保存した企画', { exact: true }).first()).toBeVisible();
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

  await name.fill('Focus Contract');
  await expect(name).not.toHaveAttribute('aria-invalid', 'true');
  await expect(editor.getByText('名前を入力してください。', { exact: true })).toHaveCount(0);

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

test('failed report stays inside the active dialog, preserves input and allows retry', async ({ page }) => {
  await page.addInitScript(() => {
    let attempts = 0;
    window.__REACT_EXTERNAL_ADAPTERS__ = {
      async bugReport() { if (++attempts === 1) throw new Error('fixture rejection'); return { ok: true }; },
    };
  });
  await page.goto('/?room=PHASE-C-REPORT-ERROR');
  await page.getByRole('button', { name: 'ユーティリティメニュー' }).click();
  await page.getByRole('menuitem', { name: 'バグを報告する', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'バグを報告', exact: true });
  const input = dialog.getByRole('textbox', { name: 'バグの内容', exact: true });
  await input.fill('再試行する報告内容');
  await dialog.getByRole('button', { name: '送信', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('送信できませんでした');
  await expect(input).toHaveValue('再試行する報告内容');
  await expect(dialog.getByRole('button', { name: '送信', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: '送信', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('バグ報告を送信しました', { exact: true })).toBeVisible();
});

test('deleting the last draft timetable row keeps keyboard focus on its add action', async ({ page }) => {
  await page.goto('/?room=PHASE-C-ROW-FOCUS&section=overview');
  await page.getByRole('button', { name: '企画情報を編集', exact: true }).click();
  const form = page.getByRole('form', { name: '企画情報を編集', exact: true });
  await form.getByRole('textbox', { name: '内容', exact: true }).fill('まだ共有しない行');
  await form.getByRole('button', { name: '削除', exact: true }).click();
  await expect(form.getByRole('button', { name: '行を追加', exact: true })).toBeFocused();
  await expect(form.getByRole('textbox', { name: '内容', exact: true })).toHaveCount(0);
});

test('refresh recovers a local overview draft without publishing it, and Cancel clears recovery', async ({ page }) => {
  const roomId = 'PHASE-C-REFRESH-DRAFT';
  await page.goto(`/?room=${roomId}&section=overview`);
  const edit = page.getByRole('button', { name: '企画情報を編集', exact: true });
  await edit.click();
  await page.getByRole('textbox', { name: '企画名', exact: true }).fill('この端末だけの下書き');
  await page.getByRole('textbox', { name: 'メモ', exact: true }).fill('更新後も復元するメモ');
  await page.reload();
  await expect(edit).toBeVisible();
  expect(await page.evaluate(id => JSON.parse(localStorage.getItem(`sanpo-react:v1:${id}:room`) || 'null')?.roomName, roomId)).not.toBe('この端末だけの下書き');
  await edit.click();
  await expect(page.getByRole('textbox', { name: '企画名', exact: true })).toHaveValue('この端末だけの下書き');
  await expect(page.getByRole('textbox', { name: 'メモ', exact: true })).toHaveValue('更新後も復元するメモ');
  await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await edit.click();
  await expect(page.getByRole('textbox', { name: '企画名', exact: true })).toHaveValue('');
  await expect(page.getByRole('textbox', { name: 'メモ', exact: true })).toHaveValue('');
});
