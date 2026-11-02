import { test, expect } from '@playwright/test';
import { createReference, fixture } from '../reference.mjs';
import { openDistanceGuideFromMovementSettings, openVehicleExpenseEditor, returnToMovementSettingsFromDistanceGuide } from './settlement-smoke-actions.mjs';

async function seedReleaseSmokeFixture(page, roomId, { savedExpense = true } = {}) {
  const legacyFixture = structuredClone(fixture);
  if (!savedExpense) delete legacyFixture.settlement.cars['仮参加者A'];
  const migratedFixture = createReference().migrateAppData(legacyFixture);
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: `sanpo-react:v1:${roomId}:room`, value: migratedFixture });
  await page.goto(`/?room=${roomId}&view=seisan`);
}

test('release fixture opens saved car expenses with the edit action', async ({ page }, testInfo) => {
  const roomId = `RELEASE-SMOKE-SAVED-${testInfo.project.name}`;
  await seedReleaseSmokeFixture(page, roomId);

  const editor = await openVehicleExpenseEditor(page, { carLabel: '仮参加者A車', action: '編集' });
  await expect(editor.getByRole('heading', { name: '費用を編集' })).toBeVisible();
  await editor.getByRole('button', { name: 'ガソリン代の計算条件を編集' }).click();
  await expect(editor.getByRole('heading', { name: 'ガソリン代を設定' })).toBeVisible();
  await openDistanceGuideFromMovementSettings(editor);
  await expect(editor.locator('.distance-guide__step')).toHaveCount(4);
  await expect(editor.getByRole('link', { name: 'Googleマップを開く' })).toHaveAttribute('href', 'https://www.google.com/maps');
  await returnToMovementSettingsFromDistanceGuide(editor);
  await expect(editor.getByRole('heading', { name: 'ガソリン代を設定' })).toBeVisible();
  await editor.getByRole('button', { name: 'ガソリン代を適用' }).click();
  await expect(editor.getByRole('heading', { name: '費用を編集' })).toBeVisible();
  await editor.getByRole('button', { name: '費用を保存' }).click();
  await expect(editor).toHaveCount(0);
});

test('release fixture opens a car without saved expenses with the input action', async ({ page }, testInfo) => {
  const roomId = `RELEASE-SMOKE-EMPTY-${testInfo.project.name}`;
  await seedReleaseSmokeFixture(page, roomId, { savedExpense: false });

  const editor = await openVehicleExpenseEditor(page, { carLabel: '仮参加者A車', action: '入力' });
  await expect(editor.getByRole('heading', { name: '費用を編集' })).toBeVisible();
});

test('production preview loads assets and preserves a room edit across critical views and reload', async ({ page }, testInfo) => {
  const origin = new URL(testInfo.project.use.baseURL).origin;
  const runtimeErrors = [];
  const badResponses = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') runtimeErrors.push(message.text()); });
  page.on('response', response => { if (response.url().startsWith(origin) && response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });

  await page.goto('/?room=PHASE8PRODUCTION');
  await expect(page).toHaveTitle('サークル企画ツール');
  await page.getByRole('button', { name: 'その他の操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '企画名を変更', exact: true }).click();
  const projectName = page.getByRole('textbox', { name: '企画名' });
  await projectName.fill('Phase 8 production smoke');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByRole('tab', { name: '参加者', exact: true }).click();
  await expect(page.getByRole('heading', { name: '参加者', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '参加者を追加', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '人数だけで精算', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '車割', exact: true }).click();
  await expect(page.getByRole('tabpanel', { name: '車割', exact: true }).locator('section.allocation-page')).toBeVisible();
  await page.getByRole('tab', { name: '班割', exact: true }).click();
  await expect(page.getByRole('tabpanel', { name: '班割', exact: true }).getByRole('heading', { name: '班割', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '精算', exact: true }).click();
  await expect(page.getByRole('tabpanel', { name: '精算', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('#project-heading')).toHaveText('Phase 8 production smoke');
  expect(runtimeErrors).toEqual([]);
  expect(badResponses).toEqual([]);
});
