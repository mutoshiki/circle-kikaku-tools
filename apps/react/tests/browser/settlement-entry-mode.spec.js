import { test, expect } from '@playwright/test';
import { fixture } from '../reference.mjs';

test('count-only settlement hides navigation, survives reload, and can return to the preserved participant workflow', async ({ page }) => {
  const roomId = 'SETTLEMENT-ENTRY-MODE-ROUNDTRIP';
  const room = structuredClone(fixture);
  await page.addInitScript(({ id, value }) => { const key = `sanpo-react:v1:${id}:room`; if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value)); }, { id: roomId, value: room });
  await page.goto(`/?room=${roomId}`);
  await expect(page.getByRole('tab', { name: '精算', exact: true })).toHaveAttribute('aria-selected', 'true');

  await page.getByRole('button', { name: '精算設定を編集', exact: true }).click();
  const settings = page.getByRole('dialog', { name: '精算設定を編集', exact: true });
  await settings.getByRole('radio', { name: '人数だけで精算', exact: true }).check({ force: true });
  await expect(settings.getByRole('spinbutton', { name: '運転手の人数' })).toHaveValue('0');
  await expect(settings.getByRole('spinbutton', { name: '同乗者の人数' })).toHaveValue('0');
  await settings.getByRole('spinbutton', { name: '運転手の人数' }).fill('1');
  await settings.getByRole('spinbutton', { name: '同乗者の人数' }).fill('2');
  await settings.getByRole('button', { name: '次へ', exact: true }).click();
  await settings.getByRole('button', { name: '次へ', exact: true }).click();
  await settings.getByRole('button', { name: '保存', exact: true }).click();
  await expect(settings).toHaveCount(0);
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '車出し1車', exact: true })).toBeVisible();

  await page.goto(`/?room=${roomId}&view=participants`);
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '車出し1車', exact: true })).toBeVisible();

  await page.getByRole('button', { name: '精算設定を編集', exact: true }).click();
  const returnSettings = page.getByRole('dialog', { name: '精算設定を編集', exact: true });
  await returnSettings.getByRole('radio', { name: '参加者を登録して精算', exact: true }).check({ force: true });
  await returnSettings.getByRole('button', { name: '次へ', exact: true }).click();
  await returnSettings.getByRole('button', { name: '次へ', exact: true }).click();
  await returnSettings.getByRole('button', { name: '保存', exact: true }).click();
  await expect(returnSettings).toHaveCount(0);
  await expect(page.getByRole('tab', { name: '精算', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: '参加者', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '参加者', exact: true }).click();
  await expect(page.getByRole('tabpanel', { name: '参加者', exact: true }).getByRole('heading', { name: /参加者 \d+人/ })).toBeVisible();
});

test('opening a count-only room with zero counts asks for counts without showing normal settlement data', async ({ page }) => {
  const roomId = 'SETTLEMENT-ENTRY-MODE-ZERO';
  const room = structuredClone(fixture);
  room.settlement.standalone = { enabled: true, driverCount: '0', memberCount: '0', driverNames: [] };
  await page.addInitScript(({ id, value }) => localStorage.setItem(`sanpo-react:v1:${id}:room`, JSON.stringify(value)), { id: roomId, value: room });
  await page.goto(`/?room=${roomId}&view=participants`);
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '人数を設定してください', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '人数を設定', exact: true })).toBeVisible();
});

test('count-only setup starts at zero without driver names and keeps vehicle-name and passenger-collector inputs', async ({ page }) => {
  await page.goto('/?room=SETTLEMENT-ENTRY-COUNT-INPUTS');
  await page.getByRole('button', { name: '人数だけで精算', exact: true }).click();
  const settings = page.getByRole('dialog', { name: '精算設定を編集', exact: true });
  const drivers = settings.getByRole('spinbutton', { name: '運転手の人数' });
  const passengers = settings.getByRole('spinbutton', { name: '同乗者の人数' });
  await expect(drivers).toHaveValue('0');
  await expect(passengers).toHaveValue('0');
  await expect(settings.getByRole('textbox', { name: /運転手\d+の名前/ })).toHaveCount(0);
  await settings.getByRole('button', { name: '次へ', exact: true }).click();
  await expect(settings.getByText('運転手または同乗者の人数を入力してください。', { exact: true })).toBeVisible();
  await drivers.fill('1');
  await passengers.fill('1');
  await settings.getByRole('button', { name: '次へ', exact: true }).click();
  await settings.getByRole('button', { name: '次へ', exact: true }).click();
  await settings.getByRole('button', { name: '保存', exact: true }).click();
  await expect(settings).toHaveCount(0);

  await page.getByRole('button', { name: '車出し1車の操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '運転手の名前を編集', exact: true }).click();
  const nameDialog = page.getByRole('dialog', { name: '運転手の名前を編集', exact: true });
  await nameDialog.getByRole('textbox', { name: '運転手の名前（任意）' }).fill('運転手の任意名');
  await nameDialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(nameDialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '運転手の任意名車', exact: true })).toBeVisible();

  await page.getByRole('button', { name: '運転手の任意名車の費用を入力', exact: true }).click();
  const carEditor = page.getByRole('dialog');
  await expect(carEditor).toBeVisible();
  await carEditor.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await expect(carEditor).toHaveCount(0);

  await page.getByRole('button', { name: '集金を記録', exact: true }).click();
  const collection = page.getByRole('dialog', { name: '集金状況', exact: true });
  await collection.locator('.cds--content-switcher-btn').first().click();
  await collection.locator('.settlement-collection-row').filter({ hasText: '参加者1' }).click();
  const collectorPrompt = page.getByRole('dialog', { name: '集金済みにする', exact: true });
  await expect(collection).toHaveCount(0);
  const collectorInput = collectorPrompt.getByRole('textbox', { name: '集金した人' });
  await collectorInput.fill('集金担当');
  await expect(collectorInput).toHaveValue('集金担当');
  await collectorPrompt.getByRole('button', { name: '保存', exact: true }).click();
  await expect(collectorPrompt).toHaveCount(0);
  await expect(collection).toBeVisible();
  await collection.getByRole('tab', { name: 'すべて', exact: true }).click();
  await expect(collection.locator('.settlement-collection-row').filter({ hasText: '集金担当' })).toContainText('回収済み');
  await collection.getByRole('button', { name: '閉じる', exact: true }).last().click();
});
