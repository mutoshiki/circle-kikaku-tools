import { test, expect } from '@playwright/test';
import { fixture } from '../reference.mjs';

const roomId = 'PARTICIPANT-ACCESSIBILITY';
const storageKey = `sanpo-react:v1:${roomId}:room`;

async function openParticipants(page) {
  await page.addInitScript(({ key, room }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(room));
  }, { key: storageKey, room: structuredClone(fixture) });
  await page.goto(`/?room=${roomId}`);
  await page.getByRole('tab', { name: '参加者', exact: true }).click();
  const choose = page.getByRole('button', { name: '参加者を選び直す', exact: true });
  if (await choose.count()) await choose.click();
}

test('active participant filters remain visible and can be cleared without changing choices', async ({ page }) => {
  await openParticipants(page);
  const filterButton = page.getByRole('button', { name: '絞り込み', exact: true });
  await expect(filterButton).toHaveAttribute('aria-controls', 'participant-filter-panel');
  await filterButton.click();
  await page.locator('#participant-filter-grade').selectOption('4');
  const firstCheckbox = page.getByRole('checkbox', { name: /を参加者に含める/ }).first();
  await firstCheckbox.focus();
  await page.keyboard.press('Space');
  const beforeClear = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);

  await filterButton.click();
  await expect(page.locator('#participant-filter-panel')).toBeHidden();
  await expect(page.locator('.participant-filter-summary')).toContainText('学年: 4年');
  await expect(page.getByRole('button', { name: '条件をクリア', exact: true })).toBeVisible();
  await expect(page.locator('.participant-results-status')).toContainText(/表示 \d+人、全 \d+人/);
  const announcedResult = await page.locator('.participant-results-status').textContent();
  const filteredCheckbox = page.getByRole('checkbox', { name: /を参加者に含める/ }).first();
  await filteredCheckbox.focus();
  await page.keyboard.press('Space');
  await page.waitForTimeout(400);
  await expect(page.locator('.participant-results-status')).toHaveText(announcedResult);
  await filterButton.click();
  await page.locator('#participant-filter-selected').selectOption('selected');
  await expect(page.locator('.participant-results-status')).toContainText('選択状態: 選択済み');
  await page.getByRole('button', { name: '条件をクリア', exact: true }).click();

  await expect(page.locator('.participant-filter-summary')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '条件をクリア', exact: true })).toHaveCount(0);
  await expect(filterButton).toBeFocused();
  await expect(page.locator('.participant-results-status')).toContainText(/表示 \d+人、全 \d+人/);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey)).toEqual(beforeClear);
});

test('search result status announces the settled result and empty results remain clearable', async ({ page }) => {
  await openParticipants(page);
  const search = page.getByRole('searchbox', { name: '名前を検索' });
  await search.fill('一致しない検索語');
  const status = page.locator('.participant-results-status');
  await expect(status).toHaveAttribute('role', 'status');
  await expect(status).toContainText('一致しない検索語');
  await expect(status).toContainText('表示 0人');
  await expect(page.getByText(/一致しない検索語.*に一致する参加者はいません/)).toBeVisible();
  await expect(page.getByRole('button', { name: '条件をクリア', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '条件をクリア', exact: true }).click();
  await expect(search).toBeFocused();
});

test('search result status waits until Japanese IME composition has ended', async ({ page }) => {
  await openParticipants(page);
  const search = page.getByRole('searchbox', { name: '名前を検索' });
  const status = page.locator('.participant-results-status');
  await search.dispatchEvent('compositionstart');
  await search.fill('変換中');
  await page.waitForTimeout(500);
  await expect(status).toBeEmpty();
  await search.dispatchEvent('compositionend', { data: '変換中' });
  await expect(status).toContainText('変換中');
});

test('destructive participant confirmation is localized, cancel-focused and restores its launcher', async ({ page }) => {
  await openParticipants(page);
  const row = page.locator('.participant-row').first();
  const participantName = await row.locator('strong').textContent();
  const trigger = row.getByRole('button', { name: `${participantName}の操作`, exact: true });
  await trigger.click();
  await page.getByRole('menuitem', { name: '削除', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '参加者を削除しますか？' });
  await expect(dialog.getByRole('button', { name: 'キャンセル', exact: true })).toBeFocused();
  await expect(dialog.getByRole('button', { name: '閉じる', exact: true })).toBeVisible();
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press('Tab');
    await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  }
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press('Shift+Tab');
    await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.getByRole('menuitem', { name: '削除', exact: true }).click();
  const closeDialog = page.getByRole('dialog', { name: '参加者を削除しますか？' });
  await closeDialog.getByRole('button', { name: '閉じる', exact: true }).click();
  await expect(closeDialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('participant editor close control is localized and returns focus to its launcher', async ({ page }) => {
  await openParticipants(page);
  const row = page.locator('.participant-row').first();
  const participantName = await row.locator('strong').textContent();
  const trigger = row.getByRole('button', { name: `${participantName}の操作`, exact: true });
  await trigger.click();
  await page.getByRole('menuitem', { name: '編集', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '参加者を編集' });
  await expect(dialog.getByRole('button', { name: '閉じる', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '閉じる', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('after confirming participant deletion, focus moves to the participant heading', async ({ page }) => {
  await openParticipants(page);
  const row = page.locator('.participant-row').first();
  const participantName = await row.locator('strong').textContent();
  await row.getByRole('button', { name: `${participantName}の操作`, exact: true }).click();
  await page.getByRole('menuitem', { name: '削除', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '参加者を削除しますか？' });
  await dialog.getByRole('button', { name: '削除', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /参加者/, level: 2 })).toBeFocused();
});
