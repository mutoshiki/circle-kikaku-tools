import { test, expect } from '@playwright/test';
import { seedVehicleCostRoom, costNav, editFee } from './vehicle-cost-fixture.js';
test.beforeEach(async ({page},info) => {
  const roomId = `COST-F-${info.project.name}-${info.testId}-${info.retry}`;
  await seedVehicleCostRoom(page,{roomId});
  await page.goto(`/?room=${roomId}&section=vehicle-costs`);
});
async function openCar(page) { await page.getByRole('link',{name:'仮参加者A車の費用を入力',exact:true}).click(); }
async function movement(page) { await editFee(page,'移動条件'); }
test('vehicle list and both callers open one car draft', async ({page}) => {
  await expect(page.getByRole('link',{name:'車両費用',exact:true})).toHaveAttribute('aria-current','page');
  await openCar(page); await movement(page);
  await page.getByRole('textbox',{name:'走行距離（km）',exact:true}).fill('200');
  await costNav(page,'精算');
  await page.getByRole('button',{name:'仮参加者A車の費用を入力',exact:true}).click();
  await movement(page);
  await expect(page.getByRole('textbox',{name:'走行距離（km）',exact:true})).toHaveValue('200');
  await costNav(page,'車割');
  await page.getByRole('link',{name:'仮参加者A車の費用',exact:true}).click();
  await movement(page);
  await expect(page.getByRole('textbox',{name:'走行距離（km）',exact:true})).toHaveValue('200');
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('heading',{level:1})).toHaveCount(1);
  await expect(page.getByRole('form')).toHaveCount(1);
  await page.getByRole('button',{name:'車両費用を保存',exact:true}).click();
  await expect(page.getByRole('heading',{level:1,name:'仮参加者A車',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'仮参加者A車の費用',exact:true})).toBeFocused();
});
test('whole-car Save reveals a hidden invalid fee', async ({page}) => {
  await openCar(page); await movement(page);
  await page.getByRole('button',{name:'費用を追加',exact:true}).click();
  await page.getByRole('textbox',{name:'費用名',exact:true}).fill('臨時費用');
  await movement(page);
  await page.getByRole('button',{name:'車両費用を保存',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'金額（円）',exact:true})).toBeFocused();
  await expect(page.getByRole('textbox',{name:'金額（円）',exact:true})).toHaveAttribute('aria-invalid','true');
  await expect(page.getByRole('status').filter({hasText:'入力を確認してください'})).toBeVisible();
});
test('private Times and signed-extra capabilities persist', async ({page}) => {
  await openCar(page); await movement(page);
  await page.getByRole('radio',{name:'自家用車',exact:true}).press('ArrowDown');
  await expect(page.getByRole('radio',{name:'タイムズ',exact:true})).toBeChecked();
  await expect(page.getByRole('textbox',{name:'燃費（km/L）',exact:true})).toHaveCount(0);
  await editFee(page,'タイムズ時間料金');
  await page.getByRole('textbox',{name:'金額（円）',exact:true}).fill('0');
  await expect(page.getByRole('menuitem',{name:'削除',exact:true})).toHaveCount(0);
  await editFee(page,'割引');
  await page.getByRole('textbox',{name:'金額（円）',exact:true}).fill('-1');
  await page.getByRole('button',{name:'車両費用を保存',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'金額（円）',exact:true})).toHaveAttribute('aria-invalid','true');
  await page.getByRole('textbox',{name:'金額（円）',exact:true}).fill('1000000');
  await expect(page.getByRole('checkbox',{name:'割勘の費用から差し引く',exact:true})).toBeChecked();
  await page.getByRole('button',{name:'車両費用を保存',exact:true}).click();
  await expect(page.getByRole('heading',{level:1,name:'車両費用',exact:true})).toBeVisible();
  await openCar(page);
  await editFee(page,'割引');
  await expect(page.getByRole('textbox',{name:'金額（円）',exact:true})).toHaveValue('1000000');
});
test('reload Back resize and Cancel preserve correct scope', async ({page}) => {
  await openCar(page); await movement(page);
  const url = page.url();
  await page.getByRole('textbox',{name:'走行距離（km）',exact:true}).fill('321');
  await page.reload();
  await expect(page.getByRole('textbox',{name:'走行距離（km）',exact:true})).toHaveValue('321');
  await page.setViewportSize({width:1280,height:900});
  await expect(page.getByRole('form')).toHaveCount(1);
  await page.setViewportSize({width:390,height:844});
  await expect(page).toHaveURL(url);
  await page.getByRole('link',{name:'費目一覧に戻る',exact:true}).click();
  await page.goBack();
  await expect(page.getByRole('textbox',{name:'走行距離（km）',exact:true})).toHaveValue('321');
  await page.getByRole('button',{name:'キャンセル',exact:true}).click();
  await openCar(page); await movement(page);
  await expect(page.getByRole('textbox',{name:'走行距離（km）',exact:true})).toHaveValue('186');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
