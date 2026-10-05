import { test, expect } from '@playwright/test';
import { seedVehicleCostRoom, vehicleFixture } from './vehicle-cost-fixture.js';
const reward = page => page.getByRole('textbox', { name: '1台あたりの協力代（円）', exact: true });
async function open(page, testInfo, room = vehicleFixture, task = 'rules') {
  const roomId = `G-RULES-${testInfo.project.name}-${testInfo.testId}-${testInfo.retry}`;
  await seedVehicleCostRoom(page, { roomId, room });
  await page.goto(`/?room=${roomId}&handoffToken=shared&section=settlement${task ? `&task=${task}` : ''}`);
  return roomId;
}
const readRoom = (page, roomId) => page.evaluate(id => JSON.parse(localStorage.getItem(`sanpo-react:v1:${id}:room`)), roomId);
test('clearing the organizer visibly clears selection and survives refresh without a shared write', async ({ page }, testInfo) => {
  const id = await open(page, testInfo);
  const organizer = page.getByRole('combobox', { name: '企画者', exact: true });
  const before = await readRoom(page, id);
  const personId = Object.keys(before.participants)[0];
  await organizer.selectOption(personId);
  await page.getByRole('button', { name: '精算ルールを保存', exact: true }).click();
  await page.getByRole('link', { name: '精算ルール', exact: true }).click();
  const saved = await readRoom(page, id);
  await organizer.selectOption(''); await expect(organizer).toHaveValue('');
  await page.reload(); await expect(organizer).toHaveValue('');
  expect((await readRoom(page, id)).settlement).toEqual(saved.settlement);
});
test('rules groups compare effects before one Save and typing never changes shared financial state', async ({ page }, testInfo) => {
  const id = await open(page, testInfo);
  await expect(page.getByRole('heading', { level: 1, name: '精算ルール', exact: true })).toBeVisible();
  await expect(page.getByRole('main')).toHaveCount(1); await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('form', { name: '精算ルール', exact: true })).toHaveCount(1);
  for (const name of ['精算対象', '割勘と端数', '車出し協力代・部費', '免除・差し引き', '計算への影響']) await expect(page.getByRole('heading', { level: 2, name, exact: true })).toBeVisible();
  const before = await readRoom(page, id); await reward(page).fill('1500');
  await expect(page.getByRole('status').filter({ hasText: /^未保存/ })).toBeVisible();
  await expect(page.getByRole('table', { name: '現在と未保存の試算' })).toContainText('費用を負担する人数');
  await expect(page.getByRole('table', { name: '現在と未保存の試算' })).toContainText('現金を集める人数');
  expect((await readRoom(page, id)).settlement).toEqual(before.settlement);
  await expect(page.getByRole('button', { name: '精算ルールを保存', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await expect(page.getByRole('link', { name: '精算ルール', exact: true })).toBeFocused();
});
test('empty participant parent enters standalone rules with no shared write', async ({ page }, testInfo) => {
  const id = await open(page, testInfo, { roomName: '人数だけの検証' }, '');
  await expect(page.getByRole('link', { name: '参加者を登録', exact: true })).toBeVisible(); const before = await readRoom(page, id);
  await page.getByRole('button', { name: '人数だけで精算', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: '精算ルール', exact: true })).toBeFocused();
  await expect(page.getByRole('textbox', { name: '運転手の人数', exact: true })).toBeVisible();
  expect((await readRoom(page, id)).settlement).toEqual(before.settlement);
  await page.getByRole('textbox', { name: '運転手の人数', exact: true }).fill('2');
  await page.getByRole('textbox', { name: '同乗者の人数', exact: true }).fill('3');
  await page.getByRole('textbox', { name: '運転手1の名前', exact: true }).fill('確認用ドライバー');
  await page.reload(); await expect(page.getByRole('textbox', { name: '運転手1の名前', exact: true })).toHaveValue('確認用ドライバー');
});
test('invalid submit focuses first field while missing costs permit valid rules Save', async ({ page }, testInfo) => {
  const room = structuredClone(vehicleFixture); room.settlement.cars['仮参加者A'].dist = '';
  await open(page, testInfo, room);
  await reward(page).fill('-300'); await reward(page).press('Tab'); await expect(reward(page)).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('button', { name: '精算ルールを保存', exact: true }).click(); await expect(reward(page)).toBeFocused();
  await reward(page).fill('900'); await expect(page.getByRole('button', { name: '精算ルールを保存', exact: true })).toBeEnabled();
  await expect(page.getByRole('region', { name: '精算に必要な入力' })).toContainText('移動距離');
  await page.getByRole('button', { name: '精算ルールを保存', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: '精算', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '精算ルール', exact: true })).toBeFocused();
});
test('current flag and rounding values do not migrate on entry or unrelated Save; protected state reloads intact', async ({ page }, testInfo) => {
  const room = structuredClone(vehicleFixture); Object.assign(room.settlement, { driverCollectionFree: true, driverCollectionOffset: true, rounding: '50', memo: '精算メモ' });
  const id = await open(page, testInfo, room);
  await expect(page.getByRole('radio', { name: '免除と差し引き（現在の設定）', exact: true })).toBeChecked();
  await expect(page.getByRole('radio', { name: '50円単位（現在の設定）', exact: true })).toBeChecked();
  const before = await readRoom(page, id); await reward(page).fill('1500'); await page.getByRole('button', { name: '精算ルールを保存', exact: true }).click();
  await page.reload(); await expect(page.getByRole('heading', { level: 1, name: '精算', exact: true })).toBeVisible();
  const after = await readRoom(page, id), expected = structuredClone(before.settlement); expected.driverReward = '1500'; expect(after.settlement).toEqual(expected);
  for (const key of ['participants', 'allocations', 'overview']) expect(after[key]).toEqual(before[key]);
});
test('protected standalone collection still records a collector through the existing brief prompt', async ({ page }, testInfo) => {
  const room = structuredClone(vehicleFixture); room.settlement.standalone = { enabled: true, driverCount: '1', memberCount: '2', driverNames: ['確認用車'] }; room.settlement.driverCollectionOffset = false;
  await open(page, testInfo, room, '');
  await page.getByRole('button', { name: '集金を確認', exact: true }).click();
  const checkbox = page.getByRole('checkbox', { name: '参加者1の集金チェック', exact: true });
  await checkbox.focus(); await checkbox.press('Space');
  const prompt = page.getByRole('dialog', { name: '集金済みにする', exact: true });
  await expect(prompt).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  const collector = prompt.getByRole('textbox', { name: '集金した人', exact: true });
  await expect(collector).toBeFocused();
  await collector.fill('確認用集金者');
  await expect(collector).toHaveValue('確認用集金者');
  await prompt.getByRole('button', { name: '保存', exact: true }).click(); await expect(prompt).toHaveCount(0);
  await page.getByRole('tab', { name: 'すべて', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: '確認用集金者の集金チェック', exact: true })).toBeChecked();
});
