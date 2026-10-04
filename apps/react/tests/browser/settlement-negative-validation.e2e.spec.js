import { test, expect } from '@playwright/test';
import { navigateToProjectSection } from './project-navigation.js';
import { editFee } from './vehicle-cost-fixture.js';

test.beforeEach(async ({ page }, testInfo) => {
  const projectId = testInfo.project.name === 'chromium-mobile' ? 'M' : 'D';
  const caseId = testInfo.title.replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase();
  const roomId = `SETVAL${projectId}${caseId}${testInfo.retry}`;
  await page.goto(`/?room=${roomId}`);
  await page.getByRole('button', { name: 'ユーティリティメニュー' }).click();
  await page.getByRole('menuitem', { name: 'サンプルデータ' }).click();
  const samples = page.getByRole('dialog', { name: 'サンプルデータ' });
  await samples.getByRole('button', { name: 'サンプルを入れる' }).click();
  await navigateToProjectSection(page, '精算');
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
});

test('expense editor rejects negative values and a zero-value row preserves settlement results',async({page})=>{
  const firstCar=page.locator('.settlement-car').first();
  const original=(await firstCar.locator('.settlement-car-breakdown').innerText()).replace(/\s+/g,'');
  await firstCar.getByRole('button',{name:/費用を入力$/}).click();
  await page.getByRole('button',{name:'費用を追加',exact:true}).click();
  await page.getByRole('textbox',{name:'費用名',exact:true}).fill('E2Eゼロ円');
  const amount=page.getByRole('textbox',{name:'金額（円）',exact:true});
  await amount.fill('-250');await expect(amount).toHaveAttribute('aria-invalid','true');
  await page.getByRole('button',{name:'車両費用を保存',exact:true}).click();
  await expect(amount).toBeFocused();
  await amount.fill('1000000000');await expect(amount).not.toHaveAttribute('aria-invalid','true');
  await amount.fill('0');await page.getByRole('button',{name:'車両費用を保存',exact:true}).click();
  expect((await firstCar.locator('.settlement-car-breakdown').innerText()).replace(/\s+/g,'')).toBe(original);
  await page.reload();expect((await firstCar.locator('.settlement-car-breakdown').innerText()).replace(/\s+/g,'')).toBe(original);
  await firstCar.getByRole('button',{name:/費用を入力$/}).click();await editFee(page,'E2Eゼロ円');
  await expect(amount).toHaveValue('0');await expect(page.getByRole('textbox',{name:'費用名',exact:true})).toHaveValue('E2Eゼロ円');
});

test('movement distance fuel economy and unit price reject negatives inline',async({page})=>{
  await page.locator('.settlement-car').first().getByRole('button',{name:/費用を入力$/}).click();await editFee(page,'移動条件');
  for(const [label,value] of [['走行距離（km）','132'],['燃費（km/L）','12'],['ガソリン単価（円/L）','172']]){
    const input=page.getByRole('textbox',{name:label,exact:true});
    await input.fill('-10');await expect(input).toHaveAttribute('aria-invalid','true');
    await page.getByRole('button',{name:'車両費用を保存',exact:true}).click();await expect(input).toBeFocused();
    await input.fill(value);await expect(input).not.toHaveAttribute('aria-invalid','true');
  }
  await page.getByRole('textbox',{name:'走行距離（km）',exact:true}).fill('1000000');
  await expect(page.getByRole('textbox',{name:'走行距離（km）',exact:true})).not.toHaveAttribute('aria-invalid','true');
  await page.getByRole('button',{name:'キャンセル',exact:true}).click();
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
