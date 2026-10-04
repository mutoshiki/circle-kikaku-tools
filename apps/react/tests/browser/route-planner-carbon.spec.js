import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { seedVehicleCostRoom, editFee } from './vehicle-cost-fixture.js';

test('route task uses keyboard text results and theme tokens without a dialog or overflow',async({page},info)=>{
  const roomId=`ROUTE-CARBON-F-${info.project.name}`;
  await seedVehicleCostRoom(page,{roomId});
  await page.goto(`/?room=${roomId}&section=vehicle-costs`);
  await page.getByRole('link',{name:'仮参加者A車の費用を入力',exact:true}).click();
  await editFee(page,'移動条件');
  const evidence=join(tmpdir(),'circle-react-migration-evidence','phase-f-after');
  for(const theme of ['light','dark']){
    if(theme==='dark'){await page.getByRole('button',{name:'ユーティリティメニュー'}).click();await page.getByRole('menuitem',{name:'ダークモードに切り替え'}).click();}
    const field=page.getByRole('textbox',{name:'走行距離（km）',exact:true});
    const styles=await field.evaluate(n=>({background:getComputedStyle(n).backgroundColor,border:getComputedStyle(n).borderBottomStyle}));
    expect(styles.background).not.toBe('rgba(0, 0, 0, 0)');expect(styles.border).toBe('solid');
    await page.screenshot({path:join(evidence,`${info.project.name}-movement-${theme}.png`),fullPage:true});
    await page.getByRole('button',{name:'ルートから距離を計算',exact:true}).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('main')).toHaveCount(1);await expect(page.getByRole('heading',{level:1})).toHaveCount(1);
    await expect(page.getByText('地点とルートはこの端末の入力履歴です。')).toBeVisible();
    await expect(page.getByRole('button',{name:'この距離を適用',exact:true})).toBeDisabled();
    await page.screenshot({path:join(evidence,`${info.project.name}-route-${theme}.png`),fullPage:true});
    await page.getByRole('link',{name:'出発地を検索',exact:true}).press('Enter');
    await page.getByRole('searchbox',{name:'場所を検索',exact:true}).fill('失敗');
    await expect(page.getByText('場所を検索できませんでした。検索語を確認して再試行してください。')).toBeVisible();
    await page.screenshot({path:join(evidence,`${info.project.name}-search-error-${theme}.png`),fullPage:true});
    await page.getByRole('link',{name:'ルートに戻る',exact:true}).click();
    await expect(page.getByRole('link',{name:'出発地を検索',exact:true})).toBeFocused();
    await page.getByRole('button',{name:'地図を表示',exact:true}).click();
    await expect(page.getByRole('application')).toHaveCount(0);
    await page.getByRole('link',{name:'移動条件に戻る',exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
});
