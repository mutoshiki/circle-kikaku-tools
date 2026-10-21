import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/legacy-v4.json', import.meta.url)));

test.beforeEach(async ({ page }, testInfo) => {
  const roomId = `MODAL-ACCESS-${testInfo.project.name}-${testInfo.retry}`;
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: `sanpo-react:v1:${roomId}:room`, value: structuredClone(fixture),
  });
  await page.goto(`/?room=${roomId}`);
});

test('vehicle expense dialog name includes the vehicle and current task', async ({ page }) => {
  await page.getByRole('tab', { name: '精算', exact: true }).click();
  const car = page.locator('.settlement-car').filter({ has: page.getByRole('heading', { name: /仮参加者A車/ }) });
  await car.getByRole('button', { name: /支払い内訳/ }).click();
  await car.getByRole('button', { name: /仮参加者A車の費用を編集/ }).click();
  const dialog = page.getByRole('dialog', { name: '仮参加者A車：費用を編集' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'ガソリン代の計算条件を編集' }).click();
  const movement = page.getByRole('dialog', { name: '仮参加者A車：ガソリン代を設定' });
  await expect(movement).toBeVisible();
  await expect(movement.getByRole('region', { name: '仮参加者A車：ガソリン代を設定の内容' })).toBeVisible();
  await page.getByRole('button', { name: '移動距離計算ツール' }).click();
  await expect(page.getByRole('dialog', { name: '仮参加者A車：移動距離計算ツール' })).toBeVisible();
  await page.getByRole('button', { name: '戻る' }).click();
  await expect(page.getByRole('dialog', { name: '仮参加者A車：ガソリン代を設定' })).toBeVisible();
  await movement.getByRole('button', { name: '戻る' }).click();
  await expect(page.getByRole('dialog', { name: '仮参加者A車：費用を編集' })).toBeVisible();
  const launcher = page.getByRole('button', { name: /仮参加者A車の費用を(?:入力|編集)/ });
  await dialog.getByRole('button', { name: '閉じる' }).click();
  await expect(launcher).toBeFocused();
});

test('collection rows use one checkbox tab stop and Space records once', async ({ page }) => {
  await page.getByRole('tab', { name: '精算', exact: true }).click();
  await page.getByRole('button', { name: '集金を記録', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '集金状況', exact: true });
  await dialog.getByRole('tab', { name: '未回収', exact: true }).click();

  const rows = dialog.locator('.settlement-collection-row:not(.excluded)');
  const first = rows.first();
  const firstCheckbox = first.getByRole('checkbox');
  const firstCheckboxId = await firstCheckbox.getAttribute('id');
  const firstParticipantName = (await first.locator('strong').first().textContent()).trim();
  const unpaidCheckboxIds = await rows.locator('.cds--checkbox').evaluateAll(elements => elements.map(element => element.id));
  await expect(firstCheckbox).toHaveAccessibleName(/の集金を記録$/);
  await expect(firstCheckbox).not.toBeChecked();
  await firstCheckbox.focus();
  await expect(firstCheckbox).toBeFocused();
  await page.keyboard.press('Tab');
  if (unpaidCheckboxIds.length > 1) await expect(dialog.locator(`[id="${unpaidCheckboxIds[1]}"]`)).toBeFocused();
  for (const [index, id] of unpaidCheckboxIds.entries()) {
    const checkbox = dialog.locator(`[id="${id}"]`);
    if (index === 0) await checkbox.focus();
    await checkbox.press(' ');
    await expect(checkbox).not.toBeAttached();
    const nextId = unpaidCheckboxIds[index + 1];
    if (nextId) await expect(dialog.locator(`[id="${nextId}"]`)).toBeFocused();
    else await expect(dialog.getByRole('tab', { name: '未回収', exact: true })).toBeFocused();
  }
  await expect(dialog.getByRole('tab', { name: '未回収', exact: true })).toBeFocused();
  await dialog.getByRole('tab', { name: 'すべて', exact: true }).click();
  await expect(dialog.locator(`[id="${firstCheckboxId}"]`)).toBeChecked();
  for (const id of unpaidCheckboxIds.slice(1)) await expect(dialog.locator(`[id="${id}"]`)).toBeChecked();
  const updatedRow = dialog.locator('.settlement-collection-row').filter({ hasText: firstParticipantName });
  await updatedRow.locator('.settlement-collection-row__label').click();
  await expect(dialog.locator(`[id="${firstCheckboxId}"]`)).not.toBeChecked();
});
