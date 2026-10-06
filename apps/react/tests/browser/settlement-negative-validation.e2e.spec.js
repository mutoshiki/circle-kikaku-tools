import {replaceSample} from './sample-workspace.js';
import { test, expect } from '@playwright/test';
import { navigateToProjectSection } from './project-navigation.js';
import { editFee } from './vehicle-cost-fixture.js';

test.beforeEach(async ({ page }, testInfo) => {
  const projectId = testInfo.project.name === 'chromium-mobile' ? 'M' : 'D';
  const caseId = testInfo.title.replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase();
  const roomId = `SETVAL${projectId}${caseId}${testInfo.retry}`;
  await page.goto(`/?room=${roomId}`);
  await replaceSample(page);
  await navigateToProjectSection(page, '精算');
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
});

test('expense editor rejects negative values and a zero-value row preserves settlement results',async({page})=>{
  await page.getByRole('link',{name:'支払いを確認',exact:true}).click();await page.getByRole('tab',{name:'すべて',exact:true}).click();
  const firstCar=page.getByRole('list',{name:/支払い対象/}).getByRole('listitem').first();
  const original=(await firstCar.getByRole('strong').innerText()).replace(/\s+/g,'');
  await firstCar.getByRole('link',{name:/費用を入力$/}).click();
  await page.getByRole('button',{name:'費用を追加',exact:true}).click();
  await page.getByRole('textbox',{name:'費用名',exact:true}).fill('E2Eゼロ円');
  const amount=page.getByRole('textbox',{name:'金額（円）',exact:true});
  await amount.fill('-250');await expect(amount).toHaveAttribute('aria-invalid','true');
  await page.getByRole('button',{name:'車両費用を保存',exact:true}).click();
  await expect(amount).toBeFocused();
  await amount.fill('1000000000');await expect(amount).not.toHaveAttribute('aria-invalid','true');
  await amount.fill('0');await page.getByRole('button',{name:'車両費用を保存',exact:true}).click();
  expect((await firstCar.getByRole('strong').innerText()).replace(/\s+/g,'')).toBe(original);
  await page.reload();expect((await firstCar.getByRole('strong').innerText()).replace(/\s+/g,'')).toBe(original);
  await firstCar.getByRole('link',{name:/費用を入力$/}).click();await editFee(page,'E2Eゼロ円');
  await expect(amount).toHaveValue('0');await expect(page.getByRole('textbox',{name:'費用名',exact:true})).toHaveValue('E2Eゼロ円');
});

test('movement distance fuel economy and unit price reject negatives inline',async({page})=>{
  await navigateToProjectSection(page,'車両費用');await page.getByRole('link',{name:/費用を入力$/}).first().click();await editFee(page,'移動条件');
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
  await page.getByRole('link', { name: '精算ルール', exact: true }).click();
  const dialog = page.getByRole('form', { name: '精算ルール', exact: true });
  await dialog.getByText('人数だけで精算', { exact: true }).click();
  const driverCount = dialog.getByLabel('運転手の人数');
  await driverCount.fill('-1');
  await driverCount.press('Tab');
  await expect(driverCount).toHaveAttribute('aria-invalid', 'true');
  await expect(dialog.getByText('0以上の人数を入力してください。', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '精算ルールを保存', exact: true }).click();
  await expect(driverCount).toBeFocused();
  await driverCount.fill('1');
  await expect(driverCount).not.toHaveAttribute('aria-invalid', 'true');
  const reward = dialog.getByLabel('1台あたりの協力代（円）');
  await reward.fill('-300');
  await reward.press('Tab');
  await expect(reward).toHaveAttribute('aria-invalid', 'true');
  await dialog.getByRole('button', { name: '精算ルールを保存', exact: true }).click();
  await expect(reward).toBeFocused();
  await expect(dialog.getByText('協力代は0円以上で入力してください。').first()).toBeVisible();
});
