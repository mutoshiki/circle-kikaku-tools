import {test,expect} from '@playwright/test';
import {seedVehicleCostRoom,vehicleFixture,editFee} from './vehicle-cost-fixture.js';

async function open(page,info,task='collection') {
  const room=structuredClone(vehicleFixture),roomId=`H-layout-${info.project.name}-${info.testId}`;
  room.roomName='長い企画名と精算確認'.repeat(15);
  room.waiting[0].name+='長い参加者名'.repeat(8);
  const car=room.cars[1],oldName=car.name;car.name+='長い車名'.repeat(8);
  room.settlement.cars[car.name]=room.settlement.cars[oldName];delete room.settlement.cars[oldName];
  room.settlement.cars[car.name].extras[1].amount='1000000000';
  await seedVehicleCostRoom(page,{roomId,room});
  await page.goto(`/?room=${roomId}&section=settlement&task=${task}`);
}
test('H pages retain one main and no document horizontal overflow',async({page},info)=>{
  await open(page,info);await page.emulateMedia({reducedMotion:'reduce'});
  const sizes=info.project.name.includes('mobile')?[[390,844],[390,500]]:[[1280,900],[1055,800],[1056,800]];
  for(const [width,height] of sizes){
    await page.setViewportSize({width,height});
    for(const theme of ['g10','g100']){
      for(const destination of ['collection','payments','','history']){
        const url=new URL(page.url());url.searchParams.set('section',destination==='history'?'history-settings':'settlement');url.searchParams.set('task',destination==='history'?'':destination);
        await page.goto(url.href);
        if(theme==='g100'){await page.getByRole('button',{name:'ユーティリティメニュー',exact:true}).click();await page.getByRole('menuitem',{name:'ダークモードに切り替え',exact:true}).click();}
        await expect(page.getByRole('main')).toHaveCount(1);await expect(page.getByRole('heading',{level:1})).toHaveCount(1);
        expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
        await expect(page.getByRole('heading',{level:1})).toBeVisible();
      }
    }
  }
});
test('keyboard checked row leaves focus on the next outstanding record',async({page},info)=>{
  await open(page,info);const boxes=page.getByRole('checkbox'),nextName=await boxes.nth(1).getAttribute('aria-label');
  await boxes.first().focus();await boxes.first().press('Space');
  await expect(page.getByRole('checkbox',{name:nextName,exact:true})).toBeFocused();
  await page.getByRole('tab',{name:'未集金',exact:true}).focus();await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab',{name:'すべて',exact:true})).toHaveAttribute('aria-selected','true');
});

test('collection record targets do not overlap names and have usable touch labels',async({page},info)=>{
  await open(page,info);
  await expect(page.getByRole('checkbox').first()).toBeVisible();
  const measured=await page.getByRole('checkbox').evaluateAll(inputs=>inputs.map(input=>{
    const row=input.closest('li'),label=document.querySelector(`label[for="${input.id}"]`),summary=row.querySelector('.operations-record-summary');
    const a=label.getBoundingClientRect(),r=row.getBoundingClientRect(),text=Array.from(summary.children).flatMap(node=>{const range=document.createRange();range.selectNodeContents(node);return [...range.getClientRects()];});
    return {overlap:text.some(b=>Math.min(a.right,b.right)>Math.max(a.left,b.left)&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top)),height:a.height,inside:a.top>=r.top&&a.bottom<=r.bottom+1};
  }));
  expect(measured.length).toBeGreaterThan(0);for(const target of measured){expect(target.overlap).toBe(false);expect(target.height).toBeGreaterThanOrEqual(44);expect(target.inside).toBe(true);}
});
test('vehicle costs return to the payment task and its reachable entry',async({page},info)=>{
  await open(page,info,'payments');const entry=page.getByRole('link',{name:/の費用を入力/}).first();
  await expect(entry).toBeVisible();const name=await entry.innerText();await entry.click();
  await editFee(page,'移動条件');await page.getByRole('button',{name:'キャンセル',exact:true}).click();
  await expect(page.getByRole('heading',{level:1,name:'支払い',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name,exact:true})).toBeFocused();
});
test('current-result confirmation preserves keyboard position',async({page},info)=>{
  await open(page,info,'payments');
  await page.evaluate(()=>{
    const id=new URL(location.href).searchParams.get('room'),key=`sanpo-ui:settlement-operations:v1:${encodeURIComponent(id)}`;
    sessionStorage.setItem(key,JSON.stringify({version:1,revision:1,filters:{collection:'outstanding',payment:'outstanding'},collectorDraft:null,memoDraft:null,operation:{kind:'restore',targetKey:'history',resetGeneration:0,operationId:'',disposition:'local',acknowledged:true}}));
  });await page.reload();
  await page.getByRole('button',{name:'現在の内容を確認',exact:true}).press('Enter');
  await expect(page.getByRole('heading',{level:1,name:'支払い',exact:true})).toBeFocused();
});
