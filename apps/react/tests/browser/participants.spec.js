import { test, expect } from '@playwright/test';
import { fixture } from '../reference.mjs';

const roomId = 'PARTICIPANT-RC';
const storageKey = `sanpo-react:v1:${roomId}:room`;

async function saved(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
}

test('participant selection checkbox announces the include action and has a semantic section heading', async ({ page }) => {
  await page.addInitScript(({ key, room }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(room));
  }, { key: storageKey, room: structuredClone(fixture) });
  await page.goto(`/?room=${roomId}`);
  await page.getByRole('tab', { name: '参加者', exact: true }).click();
  const reopenSelection = page.getByRole('button', { name: '参加者を選び直す', exact: true });
  if (await reopenSelection.count()) await reopenSelection.click();

  const row = page.locator('.participant-row').first();
  const name = await row.locator('strong').textContent();
  await expect(row.getByRole('checkbox', { name: `${name}を参加者に含める`, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /参加者/, level: 2 })).toBeVisible();
  const selected = row.getByRole('checkbox', { name: `${name}を参加者に含める`, exact: true });
  await expect(page.getByText('参加者に含める人を選んでください。', { exact: true })).toBeVisible();
  const before = await saved(page);
  await selected.focus();
  await page.keyboard.press('Space');
  await expect(selected).not.toBeChecked();
  await expect(page.locator('.selection-actions')).toContainText(/選択中：\d+人/);
  await expect(page.getByRole('button', { name: '参加者を確定', exact: true })).toBeVisible();
  expect((await saved(page)).participants).toEqual(before.participants);
});

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
  await expect(page.getByText('「存在しない名前」に一致する人はいません。', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '検索語を消去' }).click();
  await expect(page.getByRole('checkbox', { name: '仮参加者Gを参加者に含める', exact: true })).toBeVisible();
  await expect(page.locator('.selection-actions')).toHaveCount(0);
  await page.getByRole('checkbox', { name: '仮参加者Gを参加者に含める', exact: true }).check({ force: true });
  await expect(page.getByRole('checkbox', { name: '仮参加者Gを参加者に含める', exact: true })).toBeChecked();
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
  await expect(page.getByRole('checkbox', { name: '回答更新後Gを参加者に含める', exact: true })).toBeChecked();
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
  await expect(page.getByRole('checkbox', { name: '回答更新後Gを参加者に含める', exact: true })).not.toBeChecked();

  room = await saved(page);
  expect(room.participantTombstones[participantId]).toBeTruthy();
  expect(room.participants[participantId]).toBeUndefined();
  await page.reload();
  room = await saved(page);
  expect(room.participants[participantId]).toBeUndefined();
  expect(Object.values(room.participants).some(person => person.name === '回答更新後G')).toBe(false);
});

test('participant list shows assigned driver role and participant editor can toggle it', async ({ page }) => {
  const roomId = `PARTICIPANT-DRIVER-ROLE-${Date.now()}`;
  await page.goto(`/?room=${roomId}&view=participants`);
  await page.getByRole('button', { name: '参加者を追加', exact: true }).click();
  const registration = page.getByRole('dialog', { name: '参加者を登録' });
  await registration.getByRole('textbox', { name: '参加者の名前', exact: true }).fill('運転手属性 確認');
  await registration.getByText('学年・車出しを設定（任意）', { exact: true }).click();
  const registrationDriver = registration.getByRole('checkbox', { name: '運転手属性 確認を車出しに指定', exact: true });
  await registrationDriver.focus();
  await registrationDriver.press('Space');
  await expect(registrationDriver).toBeChecked();
  await registration.getByRole('button', { name: '参加者を登録', exact: true }).click();

  const row = page.locator('.participant-row').filter({ hasText: '運転手属性 確認' });
  await expect(row.getByText('運転手', { exact: true })).toBeVisible();
  await row.getByRole('button', { name: '運転手属性 確認の操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '編集', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '参加者を編集' });
  const driver = editor.getByRole('checkbox', { name: '運転手', exact: true });
  await expect(driver).toBeChecked();
  await driver.focus();
  await driver.press('Space');
  await expect(driver).not.toBeChecked();
  await editor.getByRole('button', { name: '保存', exact: true }).click();
  await expect(row.getByText('運転手', { exact: true })).toHaveCount(0);

  await row.getByRole('button', { name: '運転手属性 確認の操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '編集', exact: true }).click();
  const secondEditor = page.getByRole('dialog', { name: '参加者を編集' });
  const secondDriver = secondEditor.getByRole('checkbox', { name: '運転手', exact: true });
  await secondDriver.focus();
  await secondDriver.press('Space');
  await expect(secondDriver).toBeChecked();
  await secondEditor.getByRole('button', { name: '保存', exact: true }).click();
  await expect(row.getByText('運転手', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('tab', { name: '参加者', exact: true }).click();
  await expect(page.locator('.participant-row').filter({ hasText: '運転手属性 確認' }).getByText('運転手', { exact: true })).toBeVisible();
});
