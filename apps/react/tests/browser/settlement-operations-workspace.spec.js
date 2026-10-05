import {test,expect} from '@playwright/test';
import {seedVehicleCostRoom,vehicleFixture} from './vehicle-cost-fixture.js';
async function open(page,info,task='collection',room=vehicleFixture) {
  const roomId=`H-${info.project.name}-${info.testId}-${info.retry}`;
  await seedVehicleCostRoom(page,{roomId,room});await page.goto(`/?room=${roomId}&handoffToken=shared&section=settlement&task=${task}`);return roomId;
}
const readRoom=(page,id)=>page.evaluate(id=>JSON.parse(localStorage.getItem(`sanpo-react:v1:${id}:room`)),id);
async function touchCheckbox(page,checkbox){const id=await checkbox.getAttribute('id');await page.locator(`label[for="${id}"]`).click();}

test('direct collection entry and explicit return have meaningful focus',async({page},info)=>{
  await open(page,info);
  await expect(page.getByRole('heading',{level:1,name:'集金',exact:true})).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('link',{name:'精算へ戻る',exact:true}).click();
  await expect(page.getByRole('link',{name:'集金を確認',exact:true})).toBeFocused();
  await page.goBack();await expect(page.getByRole('heading',{level:1,name:'集金',exact:true})).toBeFocused();
  await page.reload();await expect(page.getByRole('heading',{level:1,name:'集金',exact:true})).toBeVisible();
});

test('registered direct record and reversal preserve costs participants and allocation',async({page},info)=>{
  const id=await open(page,info),before=await readRoom(page,id);
  const checkbox=page.getByRole('checkbox').first(),name=await checkbox.getAttribute('aria-label');await touchCheckbox(page,checkbox);
  await page.getByRole('tab',{name:'すべて',exact:true}).click();
  const checked=page.getByRole('checkbox',{name,exact:true});await expect(checked).toBeChecked();
  const record=await readRoom(page,id);expect(record.participants).toEqual(before.participants);expect(record.allocations).toEqual(before.allocations);
  expect(record.settlement.carsByParticipantId).toEqual(before.settlement.carsByParticipantId);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();await expect(page.getByRole('tab',{name:'すべて',exact:true})).toHaveAttribute('aria-selected','true');
  await checked.focus();await checked.press('Space');await expect(checked).not.toBeChecked();
  expect((await readRoom(page,id)).settlement.carsByParticipantId).toEqual(before.settlement.carsByParticipantId);
});

test('payment page records one vehicle and retains signed calculation detail',async({page},info)=>{
  const id=await open(page,info,'payments');const before=await readRoom(page,id);
  await expect(page.getByRole('heading',{level:1,name:'支払い',exact:true})).toBeVisible();
  await touchCheckbox(page,page.getByRole('checkbox').first());
  const after=await readRoom(page,id);expect(after.allocations).toEqual(before.allocations);expect(after.settlement.carsByParticipantId).toEqual(before.settlement.carsByParticipantId);
  await page.getByRole('tab',{name:'すべて',exact:true}).click();
  await page.getByRole('button',{name:/内訳/}).first().click();
  await expect(page.getByRole('link',{name:/車の費用を入力/}).first()).toBeVisible();
});

test('keyboard completion of last outstanding vehicle returns focus to filter',async({page},info)=>{
  await open(page,info,'payments');const checkbox=page.getByRole('checkbox').first();
  await checkbox.focus();await checkbox.press('Space');
  await expect(page.getByRole('tab',{name:'未払い',exact:true})).toBeFocused();
});

test('standalone inline draft preserves raw input and IME without a write until recorded',async({page},info)=>{
  const room=structuredClone(vehicleFixture);room.settlement.standalone={enabled:true,driverCount:'1',memberCount:'2',driverNames:['仮運転手']};
  const id=await open(page,info,'collection',room),before=await readRoom(page,id);
  await touchCheckbox(page,page.getByRole('checkbox').first());
  const input=page.getByRole('textbox',{name:'集金した人',exact:true});await expect(input).toBeFocused();await input.fill('  仮名  ');
  await input.dispatchEvent('compositionstart');await page.getByRole('form',{name:'集金した人を記録'}).dispatchEvent('submit');
  expect(await readRoom(page,id)).toEqual(before);await input.dispatchEvent('compositionend');
  await page.reload();await expect(input).toHaveValue('  仮名  ');expect(await readRoom(page,id)).toEqual(before);
  await page.getByRole('button',{name:'キャンセル',exact:true}).click();expect(await readRoom(page,id)).toEqual(before);
  await touchCheckbox(page,page.getByRole('checkbox').first());await page.getByRole('button',{name:'記録',exact:true}).click();
  await page.getByRole('tab',{name:'すべて',exact:true}).click();await expect(page.getByRole('main')).toContainText('集金した人:');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
