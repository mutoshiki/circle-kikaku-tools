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
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
});

test('expense editor rejects negative values and a zero-value row preserves settlement results', async ({ page }) => {
  const firstCar = page.locator('.settlement-car').first();
  const originalBreakdown = (await firstCar.locator('.settlement-car-breakdown').innerText()).replace(/\s+/g, '');
  await page.getByRole('button', { name: '費用を入力' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '新しい費用を追加' }).click();
  await dialog.getByLabel('名目').fill('E2Eゼロ円');
  const amount = dialog.getByRole('textbox', { name: /金額（円）/ });
  await amount.fill('-250');

  await expect(amount).toHaveAttribute('aria-invalid', 'true');
  await expect(dialog.getByRole('button', { name: '費用を追加' })).toBeDisabled();
  await amount.fill('1000000000');
  await expect(amount).not.toHaveAttribute('aria-invalid', 'true');
  await amount.fill('0');
  await expect(amount).not.toHaveAttribute('aria-invalid', 'true');
  await expect(dialog.getByRole('button', { name: '費用を追加' })).toBeEnabled();
  await dialog.getByRole('button', { name: '費用を追加' }).click();
  await expect(dialog.locator('.settlement-cost-editor')).toBeVisible();
  await dialog.getByRole('button', { name: '費用を保存' }).click();

  expect((await firstCar.locator('.settlement-car-breakdown').innerText()).replace(/\s+/g, '')).toBe(originalBreakdown);
  await page.reload();
  await page.getByRole('tab', { name: '精算', exact: true }).click();
  const reloadedCar = page.locator('.settlement-car').first();
  expect((await reloadedCar.locator('.settlement-car-breakdown').innerText()).replace(/\s+/g, '')).toBe(originalBreakdown);
  await page.getByRole('button', { name: '費用を入力' }).first().click();
  const reloadedDialog = page.getByRole('dialog');
  const zeroCost = reloadedDialog.getByRole('listitem').filter({ hasText: 'E2Eゼロ円' });
  await zeroCost.getByRole('button', { name: 'E2Eゼロ円を編集' }).click();
  await expect(reloadedDialog.getByRole('textbox', { name: /金額（円）/ })).toHaveValue('0');
  await expect(reloadedDialog.getByLabel('名目')).toHaveValue('E2Eゼロ円');
});

test('movement distance, fuel economy, and unit price reject negatives inline', async ({ page }) => {
  await page.getByRole('button', { name: '費用を入力' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'ガソリン代の計算条件を編集' }).click();
  const cases = [
    ['移動距離（km）', '-10', '移動距離'],
    ['燃費（km/L）', '-12', '燃費'],
    ['ガソリン単価（円/L）', '-172', 'ガソリン単価'],
  ];
  for (const [label, value, fieldName] of cases) {
    const input = dialog.getByLabel(label);
    await input.fill(value);
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(dialog.getByText(`${fieldName}は0より大きい値を入力してください。`, { exact: true })).toBeVisible();
    await input.fill(label === '移動距離（km）' ? '132' : label === '燃費（km/L）' ? '12' : '172');
  }
  const distance = dialog.getByLabel('移動距離（km）');
  await distance.fill('1000000');
  await expect(distance).not.toHaveAttribute('aria-invalid', 'true');
  await distance.fill('132');
  await expect(dialog.getByRole('button', { name: 'ガソリン代を適用' })).toBeEnabled();
  await dialog.getByRole('button', { name: '戻る' }).click();
  await expect(dialog.getByRole('button', { name: '費用を保存' })).toBeEnabled();
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
