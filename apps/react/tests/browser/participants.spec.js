import { test, expect } from '@playwright/test';
import { fixture } from '../reference.mjs';

const roomId = 'PARTICIPANT-RC';
const storageKey = `sanpo-react:v1:${roomId}:room`;

async function saved(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
}

test('form applicants can be selected, updated, confirmed, unconfirmed and deleted without identity revival', async ({ page }) => {
  const initial = structuredClone(fixture);
  await page.addInitScript(({ key, room }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(room));
  }, { key: storageKey, room: initial });
  await page.goto(`/?room=${roomId}`);
  await page.getByRole('tab', { name: '参加者', exact: true }).click();
  await expect(page.getByRole('button', { name: '参加者画面のその他の操作' })).toHaveCount(0);

  const confirmedStatus = page.getByText('確定済み', { exact: true });
  const reopenSelection = page.getByRole('button', { name: '参加者を選び直す', exact: true });
  await expect(confirmedStatus).toBeVisible();
  await expect(confirmedStatus.locator('xpath=ancestor::*[contains(@class,"cds--tag")]')).toBeVisible();
  await expect(reopenSelection).toHaveClass(/cds--btn--ghost/);
  const disabledHandoff = page.getByRole('button', { name: '引き継ぎデータを作成', exact: true });
  await expect(disabledHandoff).toBeDisabled();
  await expect(page.getByText(/この端末には作成権限がありません/)).toBeVisible();
  await reopenSelection.click();
  await expect(page.locator('.participant-list.cds--contained-list')).toBeVisible();
  const search = page.getByRole('searchbox', { name: '名前を検索' });
  await search.fill('存在しない名前');
  await expect(page.getByText('“存在しない名前” に一致する参加者はいません', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '検索をクリア' }).click();
  await expect(page.getByRole('checkbox', { name: '仮参加者G', exact: true })).toBeVisible();
  await expect(page.locator('.selection-actions')).toHaveCount(0);
  await page.getByRole('checkbox', { name: '仮参加者G', exact: true }).check({ force: true });
  await expect(page.getByRole('checkbox', { name: '仮参加者G', exact: true })).toBeChecked();
  await expect(page.locator('.selection-actions')).toBeVisible();
  expect(await page.locator('.selection-actions').evaluate(element => getComputedStyle(element).position)).toBe('sticky');
  const sticky = await page.locator('.selection-actions').evaluate(element => ({ right: element.getBoundingClientRect().right, width: innerWidth }));
  expect(sticky.right).toBeLessThanOrEqual(sticky.width);
  await page.getByRole('button', { name: '参加者を確定', exact: true }).click();
  await expect(page.getByText('確定済み', { exact: true })).toBeVisible();

  let room = await saved(page);
  const participantId = room.meta.applicantParticipantIds['fixture-response-g'];
  expect(room.participants[participantId].name).toBe('仮参加者G');

  room.meta.applicationSync.applicants['fixture-response-g'] = {
    ...room.meta.applicationSync.applicants['fixture-response-g'],
    name: '回答更新後G', grade: 4, canDrive: true, capacity: 2,
  };
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: storageKey, value: room });
  await page.reload();
  await page.getByRole('tab', { name: '参加者', exact: true }).click();
  await page.getByRole('button', { name: '参加者を選び直す', exact: true }).click();
  await expect(page.getByText('選び直し中', { exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: '回答更新後G', exact: true })).toBeChecked();
  await expect(page.locator('.participant-row').filter({ hasText: '回答更新後G' })).toContainText('4年 ・ 車出し可・同乗2人');

  room = await saved(page);
  expect(room.meta.applicantParticipantIds['fixture-response-g']).toBe(participantId);
  expect(room.participants[participantId].name).toBe('回答更新後G');
  expect(room.allocations.car.placements[participantId].driver).toBe(true);
  expect(Object.values(room.allocations.car.groups).find(group => group.ownerId === participantId).capacity).toBe(2);

  await page.getByRole('button', { name: '回答更新後Gの操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '削除', exact: true }).click();
  const deletion = page.getByRole('dialog', { name: '参加者を削除しますか？' });
  await deletion.getByRole('button', { name: '削除', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: '回答更新後G', exact: true })).not.toBeChecked();

  room = await saved(page);
  expect(room.participantTombstones[participantId]).toBeTruthy();
  expect(room.participants[participantId]).toBeUndefined();
  await page.reload();
  room = await saved(page);
  expect(room.participants[participantId]).toBeUndefined();
  expect(Object.values(room.participants).some(person => person.name === '回答更新後G')).toBe(false);
});
