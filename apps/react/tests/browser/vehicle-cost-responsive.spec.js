import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { seedVehicleCostRoom, vehicleFixture, editFee } from './vehicle-cost-fixture.js';

test('empty vehicle costs offers an actionable allocation destination', async ({page}, info) => {
  await page.goto(`/?room=FCOSTEMPTY-${info.project.name}&section=vehicle-costs`);
  await expect(page.getByRole('main').getByRole('link', {name:'車割を確認', exact:true})).toBeVisible();
  await page.getByRole('main').getByRole('link', {name:'車割を確認', exact:true}).press('Enter');
  await expect(page).toHaveURL(/section=organization-car/);
  await expect(page.getByRole('heading', {level:1, name:'車割', exact:true})).toBeFocused();
});

test('long content stays usable in both themes, short viewport and breakpoint changes', async ({page}, info) => {
  const room = structuredClone(vehicleFixture), name='長いドライバー名'.repeat(12), expense='長い駐車料金の名称'.repeat(12);
  room.roomName='長い企画名'.repeat(24);
  room.cars[0].name=name;
  room.settlement.cars[name]=room.settlement.cars['仮参加者A'];
  delete room.settlement.cars['仮参加者A'];
  room.settlement.cars[name].extras[0].name=expense;
  const roomId=`FCOSTGEOM-${info.project.name}`;
  await seedVehicleCostRoom(page,{roomId,room});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(`/?room=${roomId}&section=vehicle-costs`);
  await page.getByRole('link',{name:`${name}車の費用を入力`,exact:true}).click();
  await editFee(page,expense);
  const amount=page.getByRole('textbox',{name:'金額（円）',exact:true});
  await amount.fill('123456789012345');
  const durableUrl=page.url();
  for(const theme of ['light','dark']) {
    if(theme==='dark') {
      await page.getByRole('button',{name:'ユーティリティメニュー'}).click();
      await page.getByRole('menuitem',{name:'ダークモードに切り替え'}).click();
    }
    for(const width of [1055,1056,390]) {
      await page.setViewportSize({width,height:500});
      await expect(page).toHaveURL(durableUrl);
      await expect(page.getByRole('form')).toHaveCount(1);
      await expect(amount).toHaveValue('123456789012345');
      const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('main *')].map(n=>({tag:n.tagName,cls:n.className,x:n.getBoundingClientRect().x,right:n.getBoundingClientRect().right,width:n.getBoundingClientRect().width,inline:getComputedStyle(n).inlineSize,max:getComputedStyle(n).maxInlineSize,wrap:getComputedStyle(n).overflowWrap,parent:n.parentElement.getBoundingClientRect().width})).filter(n=>n.right>innerWidth)}));
      expect(geometry.scroll,JSON.stringify(geometry)).toBeLessThanOrEqual(width);
      const save=page.getByRole('button',{name:'車両費用を保存',exact:true});
      await save.scrollIntoViewIfNeeded();
      const box=await save.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x+box.width).toBeLessThanOrEqual(width);
      expect(box.y+box.height).toBeLessThanOrEqual(501);
      expect(await save.evaluate(n=>document.elementFromPoint(n.getBoundingClientRect().x+5,n.getBoundingClientRect().y+5)?.closest('button')===n)).toBe(true);
      await page.screenshot({path:join(tmpdir(),'circle-react-migration-evidence','phase-f-after',`${info.project.name}-expense-${theme}-${width}.png`),fullPage:true});
    }
    await page.getByRole('link',{name:'費目一覧に戻る',exact:true}).click();
    const menu=page.getByRole('button',{name:`${expense}の操作`,exact:true});
    const box=await menu.boundingBox(); expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
    if(info.project.use.hasTouch) await menu.tap(); else await menu.press('Enter');
    await expect(page.getByRole('menuitem',{name:'削除',exact:true})).toBeVisible();
    await menu.press('Escape');
    await editFee(page,'移動条件');
    await page.getByRole('button',{name:'ルートから距離を計算',exact:true}).click();
    await page.getByRole('link',{name:'出発地を検索',exact:true}).press('Enter');
    const place='長い施設名'.repeat(30);
    await page.getByRole('searchbox',{name:'場所を検索',exact:true}).fill(place);
    await page.getByRole('button',{name:`${place} テスト住所`,exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByRole('link',{name:'移動条件に戻る',exact:true}).click();
    await editFee(page,expense);
  }
  await page.reload(); await expect(amount).toHaveValue('123456789012345');
});
