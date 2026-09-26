import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }, testInfo) => {
  const projectId = testInfo.project.name === 'chromium-mobile' ? 'M' : 'D';
  const caseId = testInfo.title.replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase();
  const roomId = `SETVAL${projectId}${caseId}${testInfo.retry}`;
  await page.goto(`/?room=${roomId}`);
  await page.getByRole('button', { name: 'ユーティリティメニュー' }).click();
  await page.getByRole('menuitem', { name: 'サンプルデータ' }).click();
  const samples = page.getByRole('dialog', { name: 'サンプルデータ' });
  await samples.getByRole('button', { name: 'サンプルを入れる' }).click();
  await page.getByRole('tab', { name: '精算', exact: true }).click();
  const switcherOption = page.locator('.cds--content-switcher-btn').first();
  const switcherBox = await switcherOption.boundingBox();
  expect(switcherBox).not.toBeNull();
  console.log(`TARGET collection switcher ${switcherBox.width.toFixed(1)}x${switcherBox.height.toFixed(1)} ${testInfo.project.name}`);
  if (testInfo.project.name.includes('mobile')) expect(switcherBox.height).toBeGreaterThanOrEqual(44);
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
});

test('expense amounts reject negatives inline while zero saves without changing the total', async ({ page }) => {
  const status = page.locator('.settlement-status-grid');
  const originalStatus = (await status.innerText()).replace(/\s+/g, '');
  await page.getByRole('button', { name: '費用を編集' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '費用を追加' }).click();
  const row = dialog.locator('.settlement-cost-editor-details').last();
  await row.getByLabel('名目').fill('E2Eゼロ円');
  const amount = row.getByRole('textbox', { name: '金額', exact: true });
  await amount.fill('-250');

  await expect(row.getByText('金額は0円以上で入力してください。')).toBeVisible();
  await expect(dialog.getByRole('button', { name: '保存' })).toBeDisabled();
  await amount.fill('1000000000');
  await expect(row.getByText('金額は0円以上で入力してください。')).toHaveCount(0);
  await amount.fill('0');
  await expect(row.getByText('金額は0円以上で入力してください。')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: '保存' })).toBeEnabled();
  await dialog.getByRole('button', { name: '保存' }).click();

  expect((await status.innerText()).replace(/\s+/g, '')).toBe(originalStatus);
  await page.reload();
  await page.getByRole('tab', { name: '精算', exact: true }).click();
  expect((await status.innerText()).replace(/\s+/g, '')).toBe(originalStatus);
  await page.getByRole('button', { name: '費用を編集' }).first().click();
  const reloadedDialog = page.getByRole('dialog');
  await reloadedDialog.getByRole('button', { name: /E2Eゼロ円/ }).click();
  await expect(reloadedDialog.getByRole('textbox', { name: '金額', exact: true })).toHaveValue('0');
  await expect(reloadedDialog.getByLabel('名目')).toHaveValue('E2Eゼロ円');
});

test('movement distance, fuel economy, and unit price reject negatives inline', async ({ page }) => {
  await page.getByRole('button', { name: '費用を編集' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('.settlement-cost-list-item').first().click();
  const cases = [
    ['移動距離（km）', '-10'],
    ['燃費（km/L）', '-12'],
    ['ガソリン単価（円/L）', '-172'],
  ];
  for (const [label, value] of cases) {
    const input = dialog.getByLabel(label);
    await input.fill(value);
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(dialog.getByText('0以上の値を入力してください。').first()).toBeVisible();
    await input.fill(label === '移動距離（km）' ? '132' : label === '燃費（km/L）' ? '12' : '172');
  }
  const distance = dialog.getByLabel('移動距離（km）');
  await distance.fill('1000000');
  await expect(distance).not.toHaveAttribute('aria-invalid', 'true');
  await distance.fill('132');
  await expect(dialog.getByRole('button', { name: 'ガソリン代を適用' })).toBeEnabled();
  await dialog.getByRole('button', { name: '戻る' }).click();
  await expect(dialog.getByRole('button', { name: '保存' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'キャンセル' }).click();
});

test('standalone counts and driver cooperation money reject negatives inline', async ({ page }) => {
  await page.getByRole('button', { name: '精算設定を編集' }).click();
  const dialog = page.getByRole('dialog', { name: '精算設定を編集' });
  await dialog.getByText('人数だけで精算', { exact: true }).click();
  const driverCount = dialog.getByLabel('運転手の人数');
  await driverCount.fill('-1');
  await expect(driverCount).toHaveAttribute('aria-invalid', 'true');
  await expect(dialog.getByText('人数は0以上で入力してください。')).toBeVisible();
  await expect(dialog.getByRole('button', { name: '次へ' })).toBeDisabled();
  await driverCount.fill('1');
  await expect(dialog.getByRole('button', { name: '次へ' })).toBeEnabled();
  await dialog.getByRole('button', { name: '次へ' }).click();
  const reward = dialog.getByLabel('1台あたりの協力代（円）');
  await reward.fill('-300');
  await expect(reward).toHaveAttribute('aria-invalid', 'true');
  await expect(dialog.getByText('金額は0円以上で入力してください。')).toBeVisible();
  await expect(dialog.getByRole('button', { name: '次へ' })).toBeDisabled();
});
